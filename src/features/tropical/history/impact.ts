/**
 * Storm View's wind field on the History Globe: a soft disc of the storm's tropical-storm-force
 * winds riding with it (shaped by the four quadrant radii), and a faint glow left on every
 * piece of land those winds touched. The glow is painted on a canvas covering just the
 * storm's own patch of the globe, clipped to the coastline, so even a storm that crosses an
 * ocean costs one small texture.
 */
import * as THREE from "three";
import { flatRings, xyz } from "./globe-math";
import { stormAt, windField, type Radii, type Tracks } from "./data";

const KM_DEG = 111.2;
const R = Math.PI / 180;

/** The point `km` from (lat, lon) along a bearing (degrees clockwise from north). */
export function dest(lat: number, lon: number, bearing: number, km: number) {
  const d = km / 6371;
  const b = bearing * R;
  const p1 = lat * R;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b),
  );
  const l2 =
    lon * R +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return [p2 / R, l2 / R] as const;
}

/** The radius toward a bearing, eased between the four quadrant radii (NE, SE, SW, NW). */
export function radiusAt(q: readonly number[], bearing: number) {
  // Quadrant centers sit at 45, 135, 225 and 315 degrees.
  const b = (((bearing - 45) % 360) + 360) % 360;
  const k = Math.floor(b / 90);
  const f = (b - k * 90) / 90;
  const e = (1 - Math.cos(f * Math.PI)) / 2;
  return q[k] + (q[(k + 1) % 4] - q[k]) * e;
}

const FAN_VS = /* glsl */ `
  attribute float aEdge;
  varying float vEdge;
  varying vec3 vDir;
  void main() {
    vEdge = aEdge;
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FAN_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uImpact;
  uniform vec3 uOcean;
  uniform sampler2D uLand;
  uniform float uAlpha;
  varying float vEdge;
  varying vec3 vDir;
  void main() {
    // Faint in the middle, brightest just inside the edge, a soft rim.
    float a = 0.06 + 0.5 * pow(vEdge, 4.0) - 0.4 * smoothstep(0.96, 1.0, vEdge);
    // Is there land under this point? The globe's own land picture, sampled where it lies.
    vec3 d = normalize(vDir);
    float lon = atan(-d.z, d.x);
    float lat = asin(clamp(d.y, -1.0, 1.0));
    vec3 g = texture2D(uLand, vec2((lon + 3.14159265) / 6.28318531, (lat + 1.57079633) / 3.14159265)).rgb;
    float land = smoothstep(0.012, 0.045, distance(g, uOcean));
    // Over land the whole disc lights up in the glow color: the land being hit, right now.
    vec3 col = mix(uColor * a, uImpact * (0.32 + 0.9 * a), land);
    gl_FragColor = vec4(col * uAlpha, 1.0);
  }
`;
const SIDES = 72;

/** The moving wind field: a disc on the globe the size of the 34 kt winds. */
export class WindFan {
  mesh: THREE.Mesh;
  private pos = new Float32Array((SIDES + 2) * 3);
  private mat: THREE.ShaderMaterial;
  constructor(
    color: string,
    impact: string,
    ocean: string,
    land: THREE.Texture,
  ) {
    const edge = new Float32Array(SIDES + 2);
    edge.fill(1);
    edge[0] = 0;
    const index: number[] = [];
    // Counterclockwise seen from outside the globe (bearings run clockwise), so the disc
    // faces the camera; culling its back faces hides it on the globe's far side.
    for (let k = 1; k <= SIDES; k++) index.push(0, k + 1, k);
    const g = new THREE.BufferGeometry();
    g.setIndex(index);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FAN_VS,
      fragmentShader: FAN_FS,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uImpact: { value: new THREE.Color(impact) },
        uOcean: { value: new THREE.Color(ocean) },
        uLand: { value: land },
        uAlpha: { value: 1 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      // It lies a hair above the ground: a phone's coarser depth buffer can't tell the two
      // apart, so the globe would hide it. Back-face culling alone is exact on a sphere.
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }
  setColor(c: string, impact: string, ocean: string) {
    this.mat.uniforms.uColor.value = new THREE.Color(c);
    this.mat.uniforms.uImpact.value = new THREE.Color(impact);
    this.mat.uniforms.uOcean.value = new THREE.Color(ocean);
  }
  /** Puts the disc at a place with quadrant radii in km. */
  place(lat: number, lon: number, q: readonly number[], alpha = 1) {
    this.pos.set(xyz(lat, lon, 1.0035), 0);
    for (let k = 0; k <= SIDES; k++) {
      const b = (k / SIDES) * 360;
      const [la, lo] = dest(lat, lon, b, Math.max(8, radiusAt(q, b)));
      this.pos.set(xyz(la, lo, 1.0035), (k + 1) * 3);
    }
    this.mat.uniforms.uAlpha.value = alpha;
    const a = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    a.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.visible = alpha > 0;
  }
  hide() {
    this.mesh.visible = false;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/** Land the winds have touched, glowing faintly, painted as the storm moves. */
export class ImpactGlow {
  mesh: THREE.Mesh | null = null;
  private canvas = document.createElement("canvas");
  private g = this.canvas.getContext("2d")!;
  private tex = new THREE.CanvasTexture(this.canvas);
  private mat: THREE.MeshBasicMaterial;
  private land: Path2D | null = null;
  private box = { lon0: 0, lat1: 0, ppd: 1 };
  private storm = -1;
  private painted = -Infinity;
  private dirty = false;
  constructor(
    private scene: THREE.Scene,
    private t: Tracks,
    color: string,
    private maxPx: number,
  ) {
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // As the wind disc: culling, not the depth test, keeps it to the visible side.
      depthTest: false,
    });
  }

  setColor(c: string) {
    this.mat.color = new THREE.Color(c);
  }

  set opacity(v: number) {
    this.mat.opacity = v;
    if (this.mesh) this.mesh.visible = v > 0.01;
  }

  /** A fresh canvas over one storm's whole path (its widest winds included). */
  begin(i: number) {
    this.clear();
    const t = this.t;
    const o = t.storms.o[i];
    const n = t.storms.n[i];
    // Unwrap the longitudes so a storm crossing the date line stays one box.
    let lon = t.lon[o];
    let lo0 = lon;
    let lo1 = lon;
    let la0 = t.lat[o];
    let la1 = t.lat[o];
    for (let p = o + 1; p < o + n; p++) {
      let d = t.lon[p] - t.lon[p - 1];
      if (d > 180) d -= 360;
      else if (d < -180) d += 360;
      lon += d;
      lo0 = Math.min(lo0, lon);
      lo1 = Math.max(lo1, lon);
      la0 = Math.min(la0, t.lat[p]);
      la1 = Math.max(la1, t.lat[p]);
    }
    // The widest wind fields reach about 8 degrees (480 nm) from the center.
    const padLat = 8;
    const padLon =
      8 / Math.max(0.2, Math.cos(Math.max(Math.abs(la0), Math.abs(la1)) * R));
    la0 = Math.max(-89, la0 - padLat);
    la1 = Math.min(89, la1 + padLat);
    lo0 -= Math.min(30, padLon);
    lo1 += Math.min(30, padLon);
    if (lo1 - lo0 > 359) {
      lo0 = -180;
      lo1 = 179.9;
    }
    const ppd = Math.min(18, this.maxPx / Math.max(lo1 - lo0, la1 - la0));
    this.canvas.width = Math.max(8, Math.ceil((lo1 - lo0) * ppd));
    this.canvas.height = Math.max(8, Math.ceil((la1 - la0) * ppd));
    this.box = { lon0: lo0, lat1: la1, ppd };
    this.g.fillStyle = "#000";
    this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.tex.dispose();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat.map = this.tex;
    this.mat.needsUpdate = true;

    // The coastline inside the box, ready to clip each brush stroke to land.
    const path = new Path2D();
    const X = (lo: number) => (lo - lo0) * ppd;
    const Y = (la: number) => (la1 - la) * ppd;
    for (const ring of t.land)
      for (const r of flatRings(ring))
        for (const shift of [-360, 0, 360]) {
          if (r.max + shift < lo0 || r.min + shift > lo1) continue;
          path.moveTo(X(r.pts[0] + shift), Y(r.pts[1]));
          for (let k = 2; k < r.pts.length; k += 2)
            path.lineTo(X(r.pts[k] + shift), Y(r.pts[k + 1]));
          path.closePath();
        }
    this.land = path;

    const geo = new THREE.SphereGeometry(
      1.0012,
      Math.max(8, Math.ceil((lo1 - lo0) / 1.5)),
      Math.max(6, Math.ceil((la1 - la0) / 1.5)),
      (lo0 + 180) * R,
      (lo1 - lo0) * R,
      (90 - la1) * R,
      (la1 - la0) * R,
    );
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 1;
    this.scene.add(this.mesh);
    this.storm = i;
    this.painted = -Infinity;
    this.opacity = 1;
  }

  /** Paints the winds' footprint from where it stopped up to `h` hours into the storm. */
  paintTo(h: number, radii: Radii | null) {
    const i = this.storm;
    if (i < 0 || !this.land) return false;
    const t = this.t;
    const end = Math.min(h, t.hour[t.storms.o[i] + t.storms.n[i] - 1]);
    if (end <= this.painted) return false;
    const g = this.g;
    const { lon0, lat1, ppd } = this.box;
    g.save();
    g.clip(this.land, "evenodd");
    g.globalCompositeOperation = "lighten";
    // One stamp every 1.5 storm hours: dense enough that a fast storm leaves a smooth swath.
    let from = Number.isFinite(this.painted) ? this.painted + 1.5 : 0;
    for (let s = from; s <= end; s += 1.5) {
      this.stamp(s, radii, lon0, lat1, ppd);
      from = s;
    }
    g.restore();
    this.painted = from;
    this.dirty = true;
    return true;
  }

  private stamp(
    h: number,
    radii: Radii | null,
    lon0: number,
    lat1: number,
    ppd: number,
  ) {
    const t = this.t;
    const at = stormAt(t, this.storm, h);
    const f = windField(t, radii, at.f < 0.5 ? at.p : at.q, at.kt);
    // Longitude on the box's own unwrapped scale.
    let lon = at.lon;
    while (lon < lon0 - 180) lon += 360;
    while (lon > lon0 + 540) lon -= 360;
    if (lon < lon0 - 30) lon += 360;
    const cx = (lon - lon0) * ppd;
    const cy = (lat1 - at.lat) * ppd;
    const ky = ppd / KM_DEG;
    const kx = ky / Math.max(0.15, Math.cos(at.lat * R));
    const g = this.g;
    // Tropical-storm-force winds: three soft layers, so the swath fades at its edge.
    for (const [scale, a] of [
      [1, 0.2],
      [0.78, 0.24],
      [0.55, 0.28],
    ] as const) {
      g.fillStyle = `rgba(175,175,175,${a})`;
      g.beginPath();
      for (let k = 0; k < 4; k++) {
        const r = f.q[k] * scale;
        g.moveTo(cx, cy);
        g.ellipse(
          cx,
          cy,
          r * kx,
          r * ky,
          0,
          (k - 1) * (Math.PI / 2),
          k * (Math.PI / 2),
        );
      }
      g.fill();
    }
    // Hurricane-force winds burn brighter.
    if (f.r64 > 0) {
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.beginPath();
      g.ellipse(cx, cy, f.r64 * kx, f.r64 * ky, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** Wipes the glow (moving back along the path), keeping the storm's canvas and coastline. */
  reset() {
    this.g.fillStyle = "#000";
    this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.painted = -Infinity;
    this.dirty = true;
  }

  /** Sends the newest strokes to the GPU (once per drawn frame at most). */
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.tex.needsUpdate = true;
  }

  clear() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.land = null;
    this.storm = -1;
  }

  dispose() {
    this.clear();
    this.tex.dispose();
    this.mat.dispose();
  }
}
