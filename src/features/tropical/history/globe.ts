/**
 * The hurricane history globe (Tropical Outlook → History): every tropical cyclone on record
 * as a glowing line on a dark 3D Earth, in WebGL with three.js. All 700,000 track segments
 * live in one GPU buffer; filters, playback and highlighting are shader uniforms or a
 * one-pass flag rewrite, so nothing is rebuilt while the globe turns. It draws only when
 * something changes (a drag, the playback clock, a filter) and sleeps off screen.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { INTENSITY, mph } from "@/lib/tropical/style";
import {
  stormAt,
  tierIndex,
  windField,
  type Places,
  type Radii,
  type Tracks,
} from "./data";
import { ImpactGlow, WindFan } from "./impact";
import { drawPlaces, type Project } from "./places";
import { flatRings, xyz } from "./globe-math";

export { flatRings, xyz };

/** Hours since 1840-01-01, the clock every track point is placed on. */
export const BASE_H = Date.UTC(1840, 0, 1) / 3600_000;
const R = Math.PI / 180;

export type Palette = {
  /** Saffir-Simpson tiers, depression to Category 5. */
  tiers: string[];
  north: string;
  south: string;
  pick: string;
  land: string;
  ocean: string;
  coast: string;
  glow: string;
  equator: string;
  /** Places: country borders, state lines, and the three kinds of names. */
  border: string;
  stateLine: string;
  placeCountry: string;
  placeState: string;
  placeTown: string;
  /** Storm View: the moving wind field and the land it touched. */
  wind: string;
  impact: string;
};

export type Mode = "strength" | "spin";

/** A label pinned to a place; during playback it shows between `from` and `until` (epoch hours). */
export type Label = {
  key: string;
  lat: number;
  lon: number;
  text: string;
  sub?: string;
  from?: number;
  until?: number;
};

const TRACK_VS = /* glsl */ `
  attribute vec4 aInfo; // wind kt, storm index, hours since 1840, kept (0/1)
  uniform float uSel;
  uniform float uMode;
  uniform vec3 uTier[7];
  uniform vec3 uNorth;
  uniform vec3 uSouth;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vTime;
  vec3 tier(float kt) {
    if (kt >= 137.0) return uTier[6];
    if (kt >= 113.0) return uTier[5];
    if (kt >= 96.0) return uTier[4];
    if (kt >= 83.0) return uTier[3];
    if (kt >= 64.0) return uTier[2];
    if (kt >= 34.0) return uTier[1];
    return uTier[0];
  }
  void main() {
    // A filtered-out storm: both ends of each of its segments leave the screen together.
    if (aInfo.w < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; vTime = 0.0; return; }
    vec3 hemi = position.y >= 0.0 ? uNorth : uSouth;
    vColor = uMode < 0.5 ? (aInfo.x > 250.0 ? hemi : tier(aInfo.x)) : hemi;
    vTime = aInfo.z;
    vAlpha = 1.0;
    if (uSel >= 0.0 && abs(aInfo.y - uSel) > 0.5) vAlpha *= 0.28;
    // Toward the edge of the disc tracks crowd together on screen: fade them so the limb
    // keeps its color instead of burning white.
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    float facing = dot(normalize(wp), normalize(cameraPosition - wp));
    vAlpha *= smoothstep(0.02, 0.5, facing);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRACK_FS = /* glsl */ `
  uniform float uAlpha;
  uniform float uNow;
  uniform float uFresh;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vTime;
  void main() {
    // Playback draws each track up to the clock, to the minute along a segment.
    if (vAlpha <= 0.0 || vTime > uNow) discard;
    // Fresh track burns bright, then settles to the background glow.
    float fresh = uFresh > 0.0 ? clamp(1.0 - (uNow - vTime) / uFresh, 0.0, 1.0) : 0.0;
    gl_FragColor = vec4(vColor * uAlpha * vAlpha * (1.0 + 3.0 * fresh * fresh), 1.0);
  }
`;
const GLOW_VS = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const GLOW_FS = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 3.0);
    gl_FragColor = vec4(uColor * rim * 0.9, 1.0);
  }
`;
const HEAD_VS = /* glsl */ `
  attribute float aSize;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const HEAD_FS = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 4.0);
    gl_FragColor = vec4(uColor * a * 1.4, 1.0);
  }
`;

export type GlobeOpts = {
  canvas: HTMLCanvasElement;
  /** A flat canvas over the globe for place names and Storm View's label. */
  overlay: HTMLCanvasElement;
  labels: HTMLElement;
  tracks: Tracks;
  palette: Palette;
  tier: string;
  reduced: boolean;
  onPick: (storm: number | null) => void;
};

/** Up to this many storms are spinning at once on the playback clock. */
const HEADS = 96;

export class TrackGlobe {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private trackMat: THREE.ShaderMaterial;
  private info: Float32Array;
  private infoAttr: THREE.BufferAttribute;
  private pointStorm: Uint32Array;
  private land: THREE.Mesh;
  private landTex: THREE.CanvasTexture;
  private relief: HTMLImageElement | null = null;
  private pickStorm: number | null = null;
  private glow: THREE.ShaderMaterial;
  private equator: THREE.LineLoop;
  private pick: LineSegments2 | null = null;
  private pickHalo: LineSegments2 | null = null;
  private heads: THREE.Points;
  private headPos: Float32Array;
  private headSize: Float32Array;
  private byStart: number[];
  private grid = new Map<number, number[]>();
  private dirty = true;
  private raf = 0;
  private visible = true;
  private kept: Uint8Array;
  private labelEls = new Map<string, HTMLElement>();
  private labelPts: Label[] = [];
  private obs: ResizeObserver;
  private io: IntersectionObserver;
  private down: { x: number; y: number } | null = null;
  private overlay: CanvasRenderingContext2D;
  private sans: string;
  private places: Places | null = null;
  private borders: THREE.LineSegments[] = [];
  private impact: ImpactGlow;
  private fan: WindFan;
  private dragging = false;
  /** Storm View: the storm followed, its wind fields, and where it is now. */
  private sv: {
    i: number;
    radii: Radii | null;
    h: number;
    head: { lat: number; lon: number; kt: number; known: boolean } | null;
  } | null = null;
  now = Infinity;
  fresh = 0;

  constructor(private o: GlobeOpts) {
    const { canvas, tracks: t } = o;
    const low = o.tier === "low";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !low,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        low ? 1.25 : o.tier === "mid" ? 1.6 : 2,
      ),
    );
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    this.camera.position.set(...xyz(22, -60, 4.2));
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enablePan: false,
      enableDamping: !o.reduced,
      dampingFactor: 0.08,
      minDistance: 1.28,
      maxDistance: 6.5,
      rotateSpeed: 0.55,
      zoomSpeed: 0.8,
      autoRotate: !o.reduced,
      autoRotateSpeed: 0.35,
    });
    this.controls.addEventListener("change", () => {
      // Turn by what's under the finger: zoomed in, a drag moves the globe as far as the
      // ground it crosses, not a whole hemisphere.
      const d = this.camera.position.length();
      this.controls.rotateSpeed = Math.min(
        0.55,
        Math.max(0.035, (0.55 * (d - 1)) / 3.2),
      );
      this.need();
    });
    this.controls.addEventListener("start", () => {
      this.controls.autoRotate = false;
      this.dragging = true;
    });
    this.controls.addEventListener("end", () => (this.dragging = false));
    this.overlay = o.overlay.getContext("2d")!;
    this.sans =
      getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

    // Earth: the land drawn once onto an equirectangular canvas.
    const tex = document.createElement("canvas");
    tex.width = low ? 2048 : 4096;
    tex.height = tex.width / 2;
    this.landTex = new THREE.CanvasTexture(tex);
    this.landTex.colorSpace = THREE.SRGBColorSpace;
    this.landTex.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.paintLand(o.palette);
    // The relief arrives after the globe is up (it only adds shading to the land).
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      this.relief = img;
      this.paintLand(this.o.palette);
      this.need();
    };
    img.src = "/extras/tracks/relief.webp";
    this.land = new THREE.Mesh(
      new THREE.SphereGeometry(1, low ? 96 : 160, low ? 48 : 80),
      new THREE.MeshBasicMaterial({ map: this.landTex }),
    );
    this.scene.add(this.land);

    this.glow = new THREE.ShaderMaterial({
      vertexShader: GLOW_VS,
      fragmentShader: GLOW_FS,
      uniforms: { uColor: { value: new THREE.Color(o.palette.glow) } },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.scene.add(
      new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 32), this.glow),
    );

    const eq = new Float32Array(361 * 3);
    for (let k = 0; k <= 360; k++) eq.set(xyz(0, k - 180, 1.0015), k * 3);
    this.equator = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(eq, 3),
      ),
      new THREE.LineBasicMaterial({
        color: o.palette.equator,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.scene.add(this.equator);

    // Every recorded fix once (shared by the two segments it joins), and an index of the
    // segments: half the memory of drawing each segment's ends separately.
    const np = t.lat.length;
    const pos = new Float32Array(np * 3);
    this.info = new Float32Array(np * 4);
    this.pointStorm = t.storm;
    let segs = 0;
    for (let i = 0; i < t.count; i++) segs += t.storms.n[i] - 1;
    const index = new Uint32Array(segs * 2);
    let k = 0;
    for (let s = 0; s < t.count; s++) {
      const o0 = t.storms.o[s];
      const t0 = t.storms.t0[s] - BASE_H;
      for (let p = o0; p < o0 + t.storms.n[s]; p++) {
        pos.set(xyz(t.lat[p], t.lon[p], 1.003), p * 3);
        // Unknown winds stay 255, which the shader draws in the hemisphere color.
        this.info.set([t.wind[p], s, t0 + t.hour[p], 1], p * 4);
        if (p < o0 + t.storms.n[s] - 1) {
          index[k++] = p;
          index[k++] = p + 1;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.infoAttr = new THREE.BufferAttribute(this.info, 4);
    geo.setAttribute("aInfo", this.infoAttr);
    this.trackMat = new THREE.ShaderMaterial({
      vertexShader: TRACK_VS,
      fragmentShader: TRACK_FS,
      uniforms: {
        uNow: { value: 1e9 },
        uFresh: { value: 0 },
        uSel: { value: -1 },
        uMode: { value: 0 },
        uAlpha: { value: 0.12 },
        uTier: { value: o.palette.tiers.map((c) => new THREE.Color(c)) },
        uNorth: { value: new THREE.Color(o.palette.north) },
        uSouth: { value: new THREE.Color(o.palette.south) },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, this.trackMat);
    lines.frustumCulled = false;
    this.scene.add(lines);
    this.kept = new Uint8Array(t.count).fill(1);

    // Storm View's moving wind field and the land glow it leaves.
    this.fan = new WindFan(
      o.palette.wind,
      o.palette.impact,
      o.palette.ocean,
      this.landTex,
    );
    this.scene.add(this.fan.mesh);
    this.impact = new ImpactGlow(
      this.scene,
      t,
      o.palette.impact,
      low ? 640 : 1024,
    );

    // Spinning storms on the playback clock.
    this.headPos = new Float32Array(HEADS * 3);
    this.headSize = new Float32Array(HEADS);
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(this.headPos, 3));
    hg.setAttribute("aSize", new THREE.BufferAttribute(this.headSize, 1));
    this.heads = new THREE.Points(
      hg,
      new THREE.ShaderMaterial({
        vertexShader: HEAD_VS,
        fragmentShader: HEAD_FS,
        uniforms: {
          uColor: { value: new THREE.Color(o.palette.tiers[3]) },
          uScale: { value: 1 },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.heads.frustumCulled = false;
    this.heads.visible = false;
    this.scene.add(this.heads);
    this.byStart = [...Array(t.count).keys()].sort(
      (a, b) => t.storms.t0[a] - t.storms.t0[b],
    );

    // Tap lookup: point indices bucketed by whole 2° cell.
    for (let i = 0; i < t.lat.length; i++) {
      const key = this.cell(t.lat[i], t.lon[i]);
      const b = this.grid.get(key);
      if (b) b.push(i);
      else this.grid.set(key, [i]);
    }

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
    this.obs = new ResizeObserver(() => this.resize());
    this.obs.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.need();
    });
    this.io.observe(canvas);
    document.addEventListener("visibilitychange", this.onVis);
    this.resize();
    this.loop();
  }

  private cell(lat: number, lon: number) {
    return (
      Math.floor((lat + 90) / 2) * 1000 + Math.floor(((lon + 540) % 360) / 2)
    );
  }

  private paintLand(p: Palette) {
    const c = this.landTex.image as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    const W = c.width;
    const H = c.height;
    g.fillStyle = p.ocean;
    g.fillRect(0, 0, W, H);
    const X = (lon: number) => ((lon + 180) / 360) * W;
    const Y = (lat: number) => ((90 - lat) / 180) * H;
    // A faint graticule every 30°.
    g.strokeStyle = p.coast;
    g.globalAlpha = 0.12;
    g.lineWidth = W / 4096;
    g.beginPath();
    for (let lon = -150; lon < 180; lon += 30) {
      g.moveTo(X(lon), 0);
      g.lineTo(X(lon), H);
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      if (!lat) continue;
      g.moveTo(0, Y(lat));
      g.lineTo(W, Y(lat));
    }
    g.stroke();
    g.globalAlpha = 1;
    const path = new Path2D();
    for (const ring of this.o.tracks.land)
      for (const r of flatRings(ring))
        for (const shift of [-360, 0, 360]) {
          // Each copy is drawn whole; the canvas keeps the part inside ±180°.
          if (r.max + shift < -180 || r.min + shift > 180) continue;
          path.moveTo(X(r.pts[0] + shift), Y(r.pts[1]));
          for (let k = 2; k < r.pts.length; k += 2)
            path.lineTo(X(r.pts[k] + shift), Y(r.pts[k + 1]));
          path.closePath();
        }
    g.fillStyle = p.land;
    g.fill(path, "evenodd");
    // NASA's Blue Marble relief shades the land in its own color: mountains, deserts,
    // forests and ice, inside the exact coastline (the ocean stays the plain ocean color).
    if (this.relief) {
      g.save();
      g.clip(path, "evenodd");
      g.globalCompositeOperation = "screen";
      g.globalAlpha = 0.5;
      g.drawImage(this.relief, 0, 0, W, H);
      g.restore();
    }
    g.strokeStyle = p.coast;
    g.globalAlpha = 0.55;
    g.lineWidth = (W / 4096) * 1.1;
    g.stroke(path);
    g.globalAlpha = 1;
    this.landTex.needsUpdate = true;
  }

  /** Repaints everything in new colors (admin edits, theme changes). */
  setPalette(p: Palette) {
    this.o.palette = p;
    this.paintLand(p);
    const u = this.trackMat.uniforms;
    u.uTier.value = p.tiers.map((c) => new THREE.Color(c));
    u.uNorth.value = new THREE.Color(p.north);
    u.uSouth.value = new THREE.Color(p.south);
    this.glow.uniforms.uColor.value = new THREE.Color(p.glow);
    this.fan.setColor(p.wind, p.impact, p.ocean);
    this.impact.setColor(p.impact);
    const [cl, sl] = this.borders;
    (cl?.material as THREE.LineBasicMaterial | undefined)?.color.set(p.border);
    (sl?.material as THREE.LineBasicMaterial | undefined)?.color.set(
      p.stateLine,
    );
    (this.equator.material as THREE.LineBasicMaterial).color = new THREE.Color(
      p.equator,
    );
    this.need();
  }

  /** Which storms are shown (the filters): one flag per storm, spread to its segments. */
  setKept(kept: Uint8Array) {
    this.kept = kept;
    let n = 0;
    for (let k = 0; k < this.pointStorm.length; k++) {
      const v = kept[this.pointStorm[k]];
      this.info[k * 4 + 3] = v;
      n += v;
    }
    // Fewer lines can each burn brighter; the whole archive stays a soft glow.
    this.trackMat.uniforms.uAlpha.value = Math.min(
      0.9,
      Math.max(0.1, 0.1 * Math.sqrt(700_000 / Math.max(1, n))),
    );
    this.infoAttr.needsUpdate = true;
    this.need();
  }

  setMode(m: Mode) {
    this.trackMat.uniforms.uMode.value = m === "spin" ? 1 : 0;
    this.need();
  }

  /** The playback clock (epoch hours) and how long a new track burns bright; Infinity shows all. */
  setClock(epochHours: number, freshHours = 0) {
    this.now = epochHours;
    this.fresh = freshHours;
    const u = this.trackMat.uniforms;
    u.uNow.value = Number.isFinite(epochHours) ? epochHours - BASE_H : 1e9;
    u.uFresh.value = freshHours;
    this.placeHeads();
    this.need();
  }

  private placeHeads() {
    const t = this.o.tracks;
    const s = t.storms;
    let n = 0;
    if (Number.isFinite(this.now) && this.fresh > 0) {
      // Storms are sorted by start; anything that started over 90 days back has ended.
      let lo = 0;
      let hi = this.byStart.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (s.t0[this.byStart[mid]] < this.now - 2160) lo = mid + 1;
        else hi = mid;
      }
      for (let k = lo; k < this.byStart.length && n < HEADS; k++) {
        const i = this.byStart[k];
        if (s.t0[i] > this.now) break;
        if (s.t1[i] < this.now || !this.kept[i]) continue;
        const h = this.now - s.t0[i];
        const o = s.o[i];
        let p = o;
        while (p < o + s.n[i] - 1 && t.hour[p + 1] < h) p++;
        const q = Math.min(p + 1, o + s.n[i] - 1);
        const span = t.hour[q] - t.hour[p] || 1;
        const f = Math.min(1, Math.max(0, (h - t.hour[p]) / span));
        const lat = t.lat[p] + f * (t.lat[q] - t.lat[p]);
        const lon = t.lon[p] + f * (((t.lon[q] - t.lon[p] + 540) % 360) - 180);
        this.headPos.set(xyz(lat, lon, 1.004), n * 3);
        const w = t.wind[p] === 255 ? 40 : t.wind[p];
        this.headSize[n] = 0.035 + 0.0006 * w;
        n++;
      }
    }
    const g = this.heads.geometry;
    g.setDrawRange(0, n);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    this.heads.visible = n > 0;
  }

  /** Highlights one storm (or none): a thick line in its own colors over dimmed others. */
  select(i: number | null, fly = true) {
    const t = this.o.tracks;
    for (const l of [this.pick, this.pickHalo]) {
      if (!l) continue;
      this.scene.remove(l);
      l.geometry.dispose();
      (l.material as LineMaterial).dispose();
    }
    this.pick = this.pickHalo = null;
    this.pickStorm = i;
    this.trackMat.uniforms.uSel.value = i ?? -1;
    if (i !== null) {
      const o = t.storms.o[i];
      const n = t.storms.n[i];
      const pos: number[] = [];
      const col: number[] = [];
      const tiers = this.o.palette.tiers.map((c) => new THREE.Color(c));
      for (let p = o; p < o + n - 1; p++) {
        pos.push(
          ...xyz(t.lat[p], t.lon[p], 1.005),
          ...xyz(t.lat[p + 1], t.lon[p + 1], 1.005),
        );
        for (const w of [t.wind[p], t.wind[p + 1]]) {
          const c = tiers[tierIndex(w === 255 ? 0 : w)];
          col.push(c.r, c.g, c.b);
        }
      }
      const make = (width: number, opacity: number, colors: boolean) => {
        const g = new LineSegmentsGeometry().setPositions(pos);
        if (colors) g.setColors(col);
        const m = new LineMaterial({
          color: colors
            ? 0xffffff
            : new THREE.Color(this.o.palette.pick).getHex(),
          vertexColors: colors,
          linewidth: width,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: colors ? THREE.NormalBlending : THREE.AdditiveBlending,
        });
        m.resolution.set(
          this.renderer.domElement.width,
          this.renderer.domElement.height,
        );
        const l = new LineSegments2(g, m);
        l.frustumCulled = false;
        this.scene.add(l);
        return l;
      };
      this.pickHalo = make(9 * this.renderer.getPixelRatio(), 0.35, false);
      this.pick = make(2.6 * this.renderer.getPixelRatio(), 1, true);
      if (fly) {
        let mx = 0;
        let my = 0;
        let mz = 0;
        for (let p = o; p < o + n; p++) {
          const [x, y, z] = xyz(t.lat[p], t.lon[p]);
          mx += x;
          my += y;
          mz += z;
        }
        this.flyTo(new THREE.Vector3(mx, my, mz).normalize());
      }
    }
    this.need();
  }

  /** Turns the globe to face a direction (unit vector), easing over 900 ms. */
  flyTo(dir: THREE.Vector3, dist?: number) {
    const from = this.camera.position.clone();
    const r0 = from.length();
    const r1 = dist ?? Math.min(r0, 3);
    const a = from.clone().normalize();
    const start = performance.now();
    this.controls.autoRotate = false;
    const step = () => {
      const k = Math.min(
        1,
        (performance.now() - start) / (this.o.reduced ? 1 : 900),
      );
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const v = a.clone().lerp(dir, e).normalize();
      this.camera.position.copy(v.multiplyScalar(r0 + (r1 - r0) * e));
      this.controls.update();
      this.need();
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  flyToLatLon(lat: number, lon: number, dist?: number) {
    this.flyTo(new THREE.Vector3(...xyz(lat, lon)), dist);
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on && !this.o.reduced;
    this.need();
  }

  /** Text labels pinned to places (famous storms, your place); `from` hides it before that time. */
  setLabels(list: Label[]) {
    this.labelPts = list;
    for (const [k, el] of this.labelEls)
      if (!list.some((l) => l.key === k)) {
        el.remove();
        this.labelEls.delete(k);
      }
    for (const l of list) {
      let el = this.labelEls.get(l.key);
      if (!el) {
        el = document.createElement("div");
        el.className = "tg-label";
        this.o.labels.appendChild(el);
        this.labelEls.set(l.key, el);
      }
      el.innerHTML = "";
      const b = document.createElement("b");
      b.textContent = l.text;
      el.appendChild(b);
      if (l.sub) {
        const s = document.createElement("small");
        s.textContent = l.sub;
        el.appendChild(s);
      }
    }
    this.need();
  }

  private placeLabels() {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const cam = this.camera.position.clone().normalize();
    for (const l of this.labelPts) {
      const el = this.labelEls.get(l.key);
      if (!el) continue;
      const p = new THREE.Vector3(...xyz(l.lat, l.lon, 1.01));
      const facing = p.clone().normalize().dot(cam);
      const shown =
        facing > 0.25 &&
        (l.from === undefined ||
          !Number.isFinite(this.now) ||
          this.now >= l.from);
      el.style.opacity = shown ? String(Math.min(1, (facing - 0.25) * 4)) : "0";
      if (!shown) continue;
      p.project(this.camera);
      el.style.transform = `translate3d(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px, 0) translate(-50%, -120%)`;
    }
  }

  private onVis = () => {
    if (!document.hidden) this.need();
  };

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectSphere(
      new THREE.Sphere(new THREE.Vector3(), 1),
      new THREE.Vector3(),
    );
    if (!hit) return this.o.onPick(null);
    const lat = Math.asin(Math.max(-1, Math.min(1, hit.y))) / R;
    const lon = Math.atan2(-hit.z, hit.x) / R;
    // Tolerance grows as the globe zooms out (about 30 screen pixels).
    const tol = Math.max(
      0.4,
      ((this.camera.position.length() - 1) * 30 * 36) / rect.height,
    );
    this.o.onPick(this.nearest(lat, lon, tol));
  };

  /** The visible storm with a track point nearest a place, within `tol` degrees. */
  nearest(lat: number, lon: number, tol: number): number | null {
    const t = this.o.tracks;
    const now = Number.isFinite(this.now) ? this.now : Infinity;
    let best: number | null = null;
    let bestD = tol;
    const span = Math.ceil(tol / 2) + 1;
    const cos = Math.cos(lat * R);
    for (let a = -span; a <= span; a++)
      for (let b = -span; b <= span; b++) {
        const bucket = this.grid.get(this.cell(lat + a * 2, lon + b * 2));
        if (!bucket) continue;
        for (const i of bucket) {
          const s = t.storm[i];
          if (!this.kept[s] || t.storms.t0[s] + t.hour[i] > now) continue;
          const dl = ((t.lon[i] - lon + 540) % 360) - 180;
          const d = Math.hypot(t.lat[i] - lat, dl * cos);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
      }
    return best;
  }

  private resize() {
    if (this.capturing) return;
    const c = this.renderer.domElement;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const ov = this.o.overlay;
    ov.width = c.width;
    ov.height = c.height;
    const res = new THREE.Vector2(c.width, c.height);
    for (const l of [this.pick, this.pickHalo])
      (l?.material as LineMaterial | undefined)?.resolution.copy(res);
    (this.heads.material as THREE.ShaderMaterial).uniforms.uScale.value =
      h * this.renderer.getPixelRatio();
    this.need();
  }

  need() {
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden || this.capturing) return;
    const moving = this.controls.update();
    if (!this.dirty && !moving && !this.controls.autoRotate) return;
    this.dirty = false;
    this.placeLabels();
    this.impact.flush();
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay();
  };

  /** Place names and Storm View's label on the flat canvas over the globe. */
  private drawOverlay() {
    const c = this.o.overlay;
    const g = this.overlay;
    g.clearRect(0, 0, c.width, c.height);
    this.paintOverlay(
      g,
      0,
      0,
      c.width,
      c.height,
      this.renderer.getPixelRatio(),
    );
  }

  /**
   * Draws the names and the followed storm's label for the current camera into any canvas
   * (the screen's overlay, or a share frame at `x, y` sized `w`×`h`), `k` pixels per CSS px.
   */
  paintOverlay(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    k: number,
  ) {
    const project = this.projector(x, y, w, h);
    const taken: [number, number, number, number][] = [];
    const label = this.stormLabel(project, k);
    if (label) taken.push(label.box);
    if (this.places)
      drawPlaces(g, this.places, project, {
        dist: this.camera.position.length(),
        scale: k,
        w: x + w,
        h: y + h,
        colors: {
          country: this.o.palette.placeCountry,
          state: this.o.palette.placeState,
          town: this.o.palette.placeTown,
        },
        sans: this.sans,
        taken,
      });
    label?.draw(g);
  }

  /** Screen position of a place for this camera, and how far it sits from the horizon (0–1). */
  private projector(x0: number, y0: number, w: number, h: number): Project {
    const cam = this.camera.position;
    const d = cam.length();
    const v = new THREE.Vector3();
    return (lat, lon) => {
      const [px, py, pz] = xyz(lat, lon, 1.005);
      const dot = (px * cam.x + py * cam.y + pz * cam.z) / (1.005 * d);
      // In front of the horizon when dot > 1/d; 1 is straight below the camera.
      const facing = (dot - 1 / d) / (1 - 1 / d);
      if (facing <= 0) return null;
      v.set(px, py, pz).project(this.camera);
      return {
        x: x0 + ((v.x + 1) / 2) * w,
        y: y0 + ((1 - v.y) / 2) * h,
        facing,
      };
    };
  }

  /** The followed storm's name and its strength right now, above it. */
  private stormLabel(project: Project, k: number) {
    const sv = this.sv;
    if (!sv?.head) return null;
    const at = project(sv.head.lat, sv.head.lon);
    if (!at) return null;
    const t = this.o.tracks;
    const name = (t.storms.name[sv.i] || "Unnamed").toUpperCase();
    const year = String(t.storms.y[sv.i]);
    const tier = tierIndex(sv.head.kt);
    const color = this.o.palette.tiers[tier];
    const rate = sv.head.known
      ? `${INTENSITY[tier].short.toUpperCase()} · ${mph(sv.head.kt)} MPH`
      : "WINDS NOT RECORDED";
    const sans = this.sans;
    const mono =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-mono")
        .trim() || "ui-monospace, monospace";
    const nameFont = `800 ${15 * k}px ${sans}`;
    const rateFont = `800 ${10 * k}px ${mono}`;
    const yName = at.y - 44 * k;
    const yChip = at.y - 24 * k;
    const box: [number, number, number, number] = [
      at.x - 90 * k,
      yName - 14 * k,
      at.x + 90 * k,
      yChip + 12 * k,
    ];
    return {
      box,
      draw: (g: CanvasRenderingContext2D & { letterSpacing?: string }) => {
        g.save();
        g.textAlign = "center";
        g.textBaseline = "middle";
        // A short leader from the label to the storm.
        g.strokeStyle = color;
        g.globalAlpha = 0.7;
        g.lineWidth = 1.2 * k;
        g.beginPath();
        g.moveTo(at.x, yChip + 10 * k);
        g.lineTo(at.x, at.y - 7 * k);
        g.stroke();
        g.globalAlpha = 1;
        g.shadowColor = "rgba(0,0,0,0.95)";
        g.shadowBlur = 8 * k;
        g.font = nameFont;
        g.letterSpacing = `${2.6 * k}px`;
        g.fillStyle = "#ffffff";
        g.fillText(`${name}  ${year}`, at.x, yName);
        g.font = rateFont;
        g.letterSpacing = `${1.4 * k}px`;
        const tw = g.measureText(rate).width + 18 * k;
        g.shadowColor = color;
        g.shadowBlur = 12 * k;
        g.strokeStyle = color;
        g.lineWidth = 1.6 * k;
        g.fillStyle = "rgba(4,6,11,0.72)";
        g.beginPath();
        g.roundRect(at.x - tw / 2, yChip - 10 * k, tw, 20 * k, 10 * k);
        g.fill();
        g.stroke();
        g.shadowBlur = 0;
        g.fillStyle = color;
        g.fillText(rate, at.x, yChip + 0.5 * k);
        g.restore();
        g.letterSpacing = "0px";
      },
    };
  }

  /** Shows or hides the Places layer: borders on the globe, names over it. */
  setPlaces(p: Places | null) {
    for (const l of this.borders) {
      this.scene.remove(l);
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    }
    this.borders = [];
    this.places = p;
    if (p) {
      const make = (lines: Float32Array[], color: string, opacity: number) => {
        let n = 0;
        for (const l of lines) n += l.length / 2;
        const pos = new Float32Array(n * 3);
        const index: number[] = [];
        let v = 0;
        for (const l of lines) {
          for (let k = 0; k < l.length; k += 2) {
            pos.set(xyz(l[k + 1], l[k], 1.0022), (v + k / 2) * 3);
            if (k) index.push(v + k / 2 - 1, v + k / 2);
          }
          v += l.length / 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setIndex(index);
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const seg = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
          }),
        );
        seg.frustumCulled = false;
        this.scene.add(seg);
        return seg;
      };
      this.borders = [
        make(p.countryLines, this.o.palette.border, 0.55),
        make(p.stateLines, this.o.palette.stateLine, 0.3),
      ];
    }
    this.need();
  }

  /**
   * A camera that frames a storm's whole path (and its winds) on a square share frame: looking
   * at the middle of the track from just far enough out to fit its farthest point.
   */
  private framing(i: number) {
    const t = this.o.tracks;
    const o = t.storms.o[i];
    const n = t.storms.n[i];
    const mid = new THREE.Vector3();
    const pts: THREE.Vector3[] = [];
    for (let p = o; p < o + n; p++) {
      const v = new THREE.Vector3(...xyz(t.lat[p], t.lon[p]));
      pts.push(v);
      mid.add(v);
    }
    mid.normalize();
    // The farthest point from the middle, plus room for the wind field (about 6 degrees).
    let far = 0;
    for (const v of pts)
      far = Math.max(far, Math.acos(Math.min(1, v.dot(mid))));
    const th = Math.min(Math.PI / 2.2, far + 6 * R);
    // Seen from distance d, a point th from the middle sits atan(sin th / (d - cos th)) off
    // center; keep it inside 14 degrees of the 18 degree half-view.
    const d = Math.cos(th) + Math.sin(th) / Math.tan(14 * R);
    return mid.multiplyScalar(Math.min(4.6, Math.max(1.7, d)));
  }

  /** Where the camera should look while following a storm: its path smoothed over a day. */
  private aim(i: number, h: number) {
    const t = this.o.tracks;
    const last = t.hour[t.storms.o[i] + t.storms.n[i] - 1];
    const v = new THREE.Vector3();
    for (const dh of [-12, -6, 0, 6, 12]) {
      const a = stormAt(t, i, Math.min(last, Math.max(0, h + dh)));
      v.add(new THREE.Vector3(...xyz(a.lat, a.lon)));
    }
    return v.normalize();
  }

  /**
   * Storm View: one storm drawn along its path, the camera riding with it, its winds on the
   * globe and the land they touch left glowing. `radii` may arrive later (setRadii).
   */
  stormStart(i: number, radii: Radii | null) {
    this.controls.autoRotate = false;
    this.select(i, false);
    const t = this.o.tracks;
    this.sv = { i, radii, h: 0, head: null };
    this.impact.begin(i);
    this.growPick(t.storms.t0[i]);
    const d = Math.min(3, Math.max(1.9, this.camera.position.length()));
    this.flyTo(this.aim(i, 0), d);
  }

  setRadii(r: Radii) {
    if (this.sv) this.sv.radii = r;
  }

  /** Moves the followed storm to `h` hours after it began; `dt` seconds since the last step. */
  stormStep(h: number, dt: number, follow = true) {
    const sv = this.sv;
    if (!sv) return;
    const t = this.o.tracks;
    const i = sv.i;
    const last = t.hour[t.storms.o[i] + t.storms.n[i] - 1];
    const hh = Math.min(last, Math.max(0, h));
    // Moving back along the path: the glow is painted again from the start.
    if (hh < sv.h - 1e-3) this.impact.reset();
    sv.h = hh;
    const at = stormAt(t, i, hh);
    sv.head = { lat: at.lat, lon: at.lon, kt: at.kt, known: at.known };
    this.setClock(t.storms.t0[i] + hh, 30);
    this.growPick(t.storms.t0[i] + hh);
    const f = windField(t, sv.radii, at.f < 0.5 ? at.p : at.q, at.kt);
    this.fan.place(at.lat, at.lon, f.q, h > last ? 0.5 : 1);
    this.impact.paintTo(hh, sv.radii);
    if (follow && !this.dragging) {
      const cam = this.camera.position;
      const d = cam.length();
      const dir = cam
        .clone()
        .normalize()
        .lerp(this.aim(i, hh), 1 - Math.exp(-dt * 2.2))
        .normalize();
      cam.copy(dir.multiplyScalar(d));
      this.controls.update();
    }
    this.need();
  }

  /** Fades the wind field and glow out (0) or in (1) between storms. */
  stormFade(v: number) {
    this.impact.opacity = v;
    if (v <= 0.01) this.fan.hide();
    this.need();
  }

  stormStop() {
    this.sv = null;
    this.fan.hide();
    this.impact.clear();
    this.select(null, false);
    this.setClock(Infinity, 0);
  }

  /** A PNG of what's on screen (the share button). */
  private capturing: {
    ratio: number;
    w: number;
    h: number;
    cam: THREE.Vector3;
    now: number;
    fresh: number;
    spin: boolean;
    size: number;
    /** Storm View's hour when the clip began (put back afterward). */
    storm?: number;
    /** A still Storm View clip: where the camera sits for every frame. */
    frame?: THREE.Vector3;
  } | null = null;

  /**
   * Starts drawing share frames: the page's own canvas renders at `size`×`size` real pixels
   * (no screen scaling), the picked track and the spinning storms sized for that, and the
   * on-screen loop pauses until `captureEnd`.
   */
  captureStart(size: number, still = false) {
    const c = this.renderer.domElement;
    this.capturing = {
      ratio: this.renderer.getPixelRatio(),
      w: c.clientWidth,
      h: c.clientHeight,
      cam: this.camera.position.clone(),
      now: this.now,
      fresh: this.fresh,
      spin: this.controls.autoRotate,
      size,
    };
    this.controls.autoRotate = false;
    // Storm View clips start the storm's glow over from nothing; a still clip (the GIF) frames
    // the storm's whole path once, so only the storm and its glow change between frames.
    if (this.sv) {
      this.impact.begin(this.sv.i);
      this.capturing.storm = this.sv.h;
      if (still) this.capturing.frame = this.framing(this.sv.i);
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.sizeLines(size, size / 400);
  }

  /** One share frame: the clock at `epochHours`, the globe turned `turn` degrees east. */
  captureFrame(epochHours: number, freshHours: number, turn = 0) {
    const k = this.capturing;
    if (!k) throw new Error("captureStart first");
    const sv = this.sv;
    if (sv) {
      // Storm View: the camera rides with the storm, its winds and glow drawn up to then.
      const t = this.o.tracks;
      const h = epochHours - t.storms.t0[sv.i];
      this.camera.position.copy(
        k.frame ?? this.aim(sv.i, h).multiplyScalar(k.cam.length()),
      );
      this.camera.lookAt(0, 0, 0);
      this.stormStep(h, 0, false);
      this.impact.flush();
    } else {
      this.camera.position
        .copy(k.cam)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * R);
      this.camera.lookAt(0, 0, 0);
      this.setClock(epochHours, freshHours);
      this.growPick(epochHours);
    }
    this.renderer.render(this.scene, this.camera);
    const out = document.createElement("canvas");
    out.width = out.height = k.size;
    out.getContext("2d")!.drawImage(this.renderer.domElement, 0, 0);
    return out;
  }

  /**
   * The picked track drawn only as far as `epochHours` (share clips of one storm), the last
   * segment cut where the storm was at that moment; Infinity draws it whole.
   */
  private growPick(epochHours: number) {
    const i = this.pickStorm;
    if (i === null || !this.pick || !this.pickHalo) return;
    const t = this.o.tracks;
    const o = t.storms.o[i];
    const n = t.storms.n[i];
    const h = epochHours - t.storms.t0[i];
    const tiers = this.o.palette.tiers.map((c) => new THREE.Color(c));
    const pos: number[] = [];
    const col: number[] = [];
    for (let p = o; p < o + n - 1 && t.hour[p] < h; p++) {
      const span = t.hour[p + 1] - t.hour[p] || 1;
      const f = Math.min(1, (h - t.hour[p]) / span);
      const lat = t.lat[p] + f * (t.lat[p + 1] - t.lat[p]);
      const lon =
        t.lon[p] + f * (((t.lon[p + 1] - t.lon[p] + 540) % 360) - 180);
      pos.push(...xyz(t.lat[p], t.lon[p], 1.005), ...xyz(lat, lon, 1.005));
      for (const w of [t.wind[p], t.wind[p + 1]]) {
        const c = tiers[tierIndex(w === 255 ? 0 : w)];
        col.push(c.r, c.g, c.b);
      }
    }
    // A segment of no length keeps the geometry valid before the storm begins.
    if (!pos.length) {
      const a = xyz(t.lat[o], t.lon[o], 1.005);
      pos.push(...a, ...a);
      col.push(0, 0, 0, 0, 0, 0);
    }
    for (const l of [this.pick, this.pickHalo]) {
      const g = l.geometry as LineSegmentsGeometry & {
        _maxInstanceCount?: number;
      };
      g.setPositions(pos);
      if (l === this.pick) g.setColors(col);
      // three.js keeps the segment count it first drew as a ceiling; a track that grows
      // (Storm View starts each one empty) has to clear it.
      delete g._maxInstanceCount;
    }
  }

  /** Where a place falls in the last share frame (0–1 across and down), if it faces the camera. */
  project(lat: number, lon: number) {
    const p = new THREE.Vector3(...xyz(lat, lon, 1.01));
    const facing = p
      .clone()
      .normalize()
      .dot(this.camera.position.clone().normalize());
    if (facing < 0.2) return null;
    p.project(this.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }

  /** Puts the page's globe back as the viewer left it. */
  captureEnd() {
    const k = this.capturing;
    if (!k) return;
    this.capturing = null;
    this.camera.position.copy(k.cam);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setPixelRatio(k.ratio);
    this.controls.autoRotate = k.spin;
    if (this.sv && k.storm !== undefined) {
      this.impact.begin(this.sv.i);
      this.stormStep(k.storm, 0, false);
    } else {
      this.setClock(k.now, k.fresh);
      this.growPick(Infinity);
    }
    this.resize();
    this.sizeLines(0, this.renderer.getPixelRatio());
    this.need();
  }

  /** The picked track's widths and the storm dots' scale for an output of `scale` px per CSS px. */
  private sizeLines(size: number, scale: number) {
    const c = this.renderer.domElement;
    const res = new THREE.Vector2(size || c.width, size || c.height);
    for (const [l, w] of [
      [this.pickHalo, 9],
      [this.pick, 2.6],
    ] as const) {
      const m = l?.material as LineMaterial | undefined;
      if (!m) continue;
      m.linewidth = w * scale;
      m.resolution.copy(res);
    }
    (this.heads.material as THREE.ShaderMaterial).uniforms.uScale.value =
      size || c.height;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.obs.disconnect();
    this.io.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.onDown);
    c.removeEventListener("pointerup", this.onUp);
    this.controls.dispose();
    this.scene.traverse((x) => {
      const m = x as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((q) => q.dispose());
    });
    this.landTex.dispose();
    this.impact.dispose();
    this.fan.dispose();
    for (const el of this.labelEls.values()) el.remove();
    this.renderer.dispose();
  }
}
