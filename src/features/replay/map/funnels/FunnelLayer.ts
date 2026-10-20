import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  tornadoPositionAt,
  widthAt,
  type PreparedTornado,
} from "@/features/replay/core/chase";
import { characterOf, lifeAt } from "./lifecycle";
import {
  EARTH_CIRCUMFERENCE,
  metresToMercator,
  mercatorX,
  mercatorY,
} from "./mercator";
import { EF_SPIN, FUNNEL_FRAG, FUNNEL_VERT } from "./shaders";
import { buildNoise3D, NOISE_SIZE } from "./noise3d";
import { reportError } from "@/features/replay/report";

/**
 * Every tornado on the ground, in one draw call.
 *
 * Instancing is what makes the volume affordable. 27 April 2011 puts more
 * than thirty tornadoes on the ground at once; a canvas or a draw call each —
 * which is how the old app did it, and why it lagged — spends the budget
 * before any of them look like anything. Here the per-funnel cost is sixteen
 * floats, and everything spent on the look is spent in the fragment shader.
 */

const FLOATS_PER_INSTANCE = 16; // pos(2) size(4) look(4) form(4) more(2)

/**
 * The smallest a funnel is drawn, in CSS pixels of height, and the thinnest
 * its base. The old app did this and it was right: a 1,500 m funnel is a few
 * pixels tall at county zoom, and a tornado you cannot see is not a
 * rendering style. The swath on the ground still shows the true width.
 */
const MIN_HEIGHT_PX = 100;
const MIN_BASE_RADIUS_PX = 2.5;

/** The funnels fade in as the map tilts; flat, the ground icon takes over. */
const FADE_PITCH: [number, number] = [14, 32];

/** The rotation keeps turning while paused, at this rate. */
const IDLE_FRAME_MS = 33;

export interface FunnelSettings {
  /** Off entirely, for the performance preset. */
  enabled: boolean;
  /** Cap, so a 200-tornado day cannot melt a phone. */
  maxFunnels: number;
  /** Multiplier on the drawn height — taste, not data. */
  heightScale: number;
  /**
   * Samples across the column. The one honest performance dial: 24 with
   * dithering looks like 64, 12 is grainier but still volumetric. Never a
   * resolution cut — a half-resolution funnel is blurry at every step count.
   */
  steps: number;
}

export const DEFAULT_FUNNEL_SETTINGS: FunnelSettings = {
  enabled: true,
  maxFunnels: 64,
  heightScale: 1,
  steps: 24,
};

export class FunnelLayer implements CustomLayerInterface {
  readonly id = "funnels";
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map: MapLibreMap | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private cornerBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  /** Built when the clock or the zoom moves; drawn from `upload`, sorted. */
  private instances = new Float32Array(
    FLOATS_PER_INSTANCE * DEFAULT_FUNNEL_SETTINGS.maxFunnels,
  );
  private upload = new Float32Array(
    FLOATS_PER_INSTANCE * DEFAULT_FUNNEL_SETTINGS.maxFunnels,
  );
  private count = 0;
  private flash = 0;
  private builtZoom = NaN;

  private tornadoes: readonly PreparedTornado[] = [];
  private at = 0;
  private settings: FunnelSettings = DEFAULT_FUNNEL_SETTINGS;

  /** The cloud base a funnel is made of, from the solar grade. */
  private cloud: [number, number, number] = [0.62, 0.64, 0.68];
  /** Toward the sun, in the funnels' local space: east, up, north. */
  private sun: [number, number, number] = [-0.6, 0.35, 0.6];

  private noiseTex: WebGLTexture | null = null;
  private readonly still =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Adaptive quality: a multiplier on the step count that follows the frame
   * rate. A funnel filling a phone screen is the most expensive thing the app
   * draws; rather than lag, it gets a little grainier until the frames are
   * back on time, and recovers slowly once they are.
   */
  private quality = 1;
  private lastRender = 0;
  private expectedMs = 1000 / 60;
  private slow = 0;
  private fast = 0;

  setCloud(rgb: readonly [number, number, number]) {
    this.cloud = [rgb[0], rgb[1], rgb[2]];
  }

  /**
   * `azimuthDeg` clockwise from north, `altitudeDeg` above the horizon. In
   * world space, so it is right at every bearing without being refreshed
   * when the map turns. Below the horizon the light keeps its direction —
   * the glow is still where the sun went down.
   */
  setSun(azimuthDeg: number, altitudeDeg: number) {
    const az = (azimuthDeg * Math.PI) / 180;
    const alt = (Math.max(-4, altitudeDeg) * Math.PI) / 180;
    const h = Math.cos(alt);
    this.sun = [Math.sin(az) * h, Math.sin(alt), Math.cos(az) * h];
  }

  /** What to draw, and when. Called whenever the clock moves. */
  setFrame(
    tornadoes: readonly PreparedTornado[],
    at: number,
    settings: FunnelSettings,
  ) {
    this.tornadoes = tornadoes;
    this.at = at;
    if (settings.maxFunnels !== this.settings.maxFunnels) {
      this.instances = new Float32Array(
        FLOATS_PER_INSTANCE * settings.maxFunnels,
      );
      this.upload = new Float32Array(FLOATS_PER_INSTANCE * settings.maxFunnels);
    }
    this.settings = settings;
    this.build();
    this.map?.triggerRepaint();
  }

  /**
   * Fill the instance buffer for this moment and this zoom.
   *
   * Out of `render` because the data only changes when the clock or the zoom
   * does; panning a paused map rebuilds nothing.
   */
  private build() {
    this.builtZoom = this.map?.getZoom() ?? NaN;
    if (!this.settings.enabled) {
      this.count = 0;
      return;
    }

    const arr = this.instances;
    const zoom = Number.isFinite(this.builtZoom) ? this.builtZoom : 12;
    let n = 0;
    let flash = 0;

    // Strongest first, so the cap keeps the tornadoes worth looking at.
    const candidates = [...this.tornadoes].sort(
      (a, b) => b.widthYd - a.widthYd,
    );

    for (const t of candidates) {
      if (n >= this.settings.maxFunnels) break;
      const ch = characterOf(t.ef);
      const life = lifeAt(
        t.start,
        t.end,
        this.at,
        ch,
        performance.now() / 1000,
      );
      if (life.phase === "before" || life.phase === "after") continue;

      // During the forming phase it hangs over the touchdown point.
      const when = Math.max(t.start, this.at);
      const [lat, lon] = tornadoPositionAt(t, when);
      const perMetre = metresToMercator(lat);
      const mpp =
        (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
        (512 * 2 ** zoom);

      // The surveyed width where it was at this moment.
      const widthM =
        Math.max(widthAt(t, when) * 0.9144, ch.baseWidthM * 0.35) *
        life.widthScale;
      const heightM = Math.max(
        ch.heightM * this.settings.heightScale,
        MIN_HEIGHT_PX * mpp,
      );
      // Radii in funnel heights, so x and y share a unit and nothing is squashed.
      const rb = Math.max(
        0.006,
        widthM / 2 / heightM,
        (MIN_BASE_RADIUS_PX * mpp) / heightM,
      );
      const rt = rb * 1.3 + 0.06;
      const rc = Math.min(rt * 2.6, rt + 0.35);
      const bend = rb < 0.06 ? 0.05 : 0;
      const wobble = ch.wobbleM / heightM;
      const tilt = life.tilt;
      const bound =
        Math.max(rt * 1.3, (rb * 1.7 + 0.035) * 1.2 * 1.4, rc * 1.55) +
        Math.abs(tilt) * 0.9 +
        bend +
        wobble +
        0.02;

      // Which way it is heading: the column leans with the motion.
      const [la2, lo2] = tornadoPositionAt(t, Math.min(t.end, when + 60));
      const [la1, lo1] = tornadoPositionAt(t, Math.max(t.start, when - 60));
      let lx = (lo2 - lo1) * Math.cos((lat * Math.PI) / 180);
      let lz = la2 - la1;
      const ll = Math.hypot(lx, lz);
      if (ll > 1e-9) {
        lx /= ll;
        lz /= ll;
      } else {
        lx = 1;
        lz = 0;
      }

      const o = n * FLOATS_PER_INSTANCE;
      arr[o + 0] = mercatorX(lon);
      arr[o + 1] = mercatorY(lat);
      arr[o + 2] = heightM * perMetre;
      arr[o + 3] = bound;
      arr[o + 4] = life.intensity;
      arr[o + 5] = life.reach;
      arr[o + 6] = ch.darkness;
      arr[o + 7] = ch.debris;
      // A stable per-tornado seed, so each wanders in its own way.
      arr[o + 8] = ((t.index * 2654435761) % 1000) / 1000;
      arr[o + 9] = EF_SPIN[t.ef] ?? 1;
      arr[o + 10] = rb;
      arr[o + 11] = tilt;
      arr[o + 12] = lx;
      arr[o + 13] = lz;
      arr[o + 14] = bend;
      arr[o + 15] = wobble;

      flash = Math.max(flash, life.flash);
      n += 1;
    }

    this.count = n;
    this.flash = flash;
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;

    const program = link(gl, FUNNEL_VERT, FUNNEL_FRAG);
    if (!program) return;
    this.program = program;

    for (const u of [
      "u_matrix",
      "u_inverse",
      "u_camera",
      "u_time",
      "u_cloud",
      "u_flash",
      "u_sun",
      "u_steps",
      "u_fade",
      "u_noise",
    ]) {
      this.uniforms[u] = gl.getUniformLocation(program, u);
    }

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // One quad; the vertex shader stretches it over the funnel's screen extent.
    this.cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const corner = gl.getAttribLocation(program, "a_corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.upload.byteLength, gl.DYNAMIC_DRAW);

    const stride = FLOATS_PER_INSTANCE * 4;
    const attrib = (name: string, size: number, offsetFloats: number) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        size,
        gl.FLOAT,
        false,
        stride,
        offsetFloats * 4,
      );
      gl.vertexAttribDivisor(loc, 1);
    };
    attrib("a_pos", 2, 0);
    attrib("a_size", 4, 2);
    attrib("a_look", 4, 6);
    attrib("a_form", 4, 10);
    attrib("a_more", 2, 14);

    gl.bindVertexArray(null);

    // The noise volume, built once: a texture lookup in the march's inner
    // loop instead of hundreds of instructions of arithmetic noise.
    this.noiseTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA8,
      NOISE_SIZE,
      NOISE_SIZE,
      NOISE_SIZE,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      buildNoise3D(NOISE_SIZE),
    );
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
    }
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.cornerBuffer) gl.deleteBuffer(this.cornerBuffer);
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
    if (this.noiseTex) gl.deleteTexture(this.noiseTex);
    this.noiseTex = null;
    this.program = null;
    this.vao = null;
    this.cornerBuffer = null;
    this.instanceBuffer = null;
    this.map = null;
  }

  /** Scratch, so the per-frame matrix work allocates nothing. */
  private readonly matrix = new Float32Array(16);
  private readonly inverse = new Float32Array(16);
  private readonly inv64 = new Float64Array(16);
  private readonly camera: [number, number, number] = [0, 0, 0];
  private readonly order: number[] = [];

  /**
   * Where instance 0 is and where the camera is, for diagnosing an invisible
   * layer — a custom layer that draws nothing gives no error.
   */
  probe(): Record<string, unknown> | null {
    if (this.count === 0) return null;
    return {
      count: this.count,
      merc: [+this.instances[0]!.toFixed(6), +this.instances[1]!.toFixed(6)],
      heightMerc: this.instances[2],
      bound: this.instances[3],
      camera: [...this.camera],
      zoom: this.builtZoom,
      quality: this.quality,
    };
  }

  /** Set when drawing threw; the layer then stays off rather than taking the map's frames down with it (#6). */
  private broken = false;

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (this.broken) return;
    try {
      this.draw(gl, options);
    } catch (err) {
      this.broken = true;
      try {
        gl.bindVertexArray(null);
      } catch {
        /* the context itself may be gone */
      }
      console.error(`${this.id}: switched off after a drawing error`, err);
      reportError(err, { source: "layer", layer: this.id });
    }
  }

  private draw(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    const map = this.map;
    if (!this.program || !this.vao || !map) return;
    this.pace();
    // The minimum on-screen size depends on the zoom; follow it.
    if (Math.abs(map.getZoom() - this.builtZoom) > 0.02) this.build();
    if (this.count === 0) return;

    const pitch = map.getPitch();
    const fade = smoothstep(FADE_PITCH[0], FADE_PITCH[1], pitch);
    if (fade <= 0) return;

    /*
     * `mainMatrix` projects spherical mercator with a conformal z — the space
     * every position here is built in. It arrives as 64-bit; uniformMatrix4fv
     * takes 32-bit only, and silently keeps the identity if handed the other.
     */
    const src = options.defaultProjectionData
      .mainMatrix as unknown as ArrayLike<number>;
    for (let i = 0; i < 16; i += 1) this.matrix[i] = src[i] as number;
    if (!invert(src, this.inv64)) return;
    for (let i = 0; i < 16; i += 1) this.inverse[i] = this.inv64[i]!;
    // The camera is the point the projection sends to w = 0: clip (0,0,1,0).
    const iv = this.inv64;
    const cw = iv[11]!;
    if (Math.abs(cw) < 1e-30) return;
    this.camera[0] = iv[8]! / cw;
    this.camera[1] = iv[9]! / cw;
    this.camera[2] = iv[10]! / cw;

    // Back to front, so overlapping funnels composite in the right order.
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < this.count; i += 1) order.push(i);
    const dist = (i: number) => {
      const o = i * FLOATS_PER_INSTANCE;
      const dx = this.instances[o]! - this.camera[0];
      const dy = this.instances[o + 1]! - this.camera[1];
      const dz = this.instances[o + 2]! * 0.5 - this.camera[2];
      return dx * dx + dy * dy + dz * dz;
    };
    order.sort((a, b) => dist(b) - dist(a));
    for (let k = 0; k < order.length; k += 1) {
      const from = order[k]! * FLOATS_PER_INSTANCE;
      this.upload.set(
        this.instances.subarray(from, from + FLOATS_PER_INSTANCE),
        k * FLOATS_PER_INSTANCE,
      );
    }

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.upload.subarray(0, this.count * FLOATS_PER_INSTANCE),
    );

    // Wall-clock time, not replay time: at 750x a funnel turning in replay
    // seconds would strobe; it should turn the way a tornado turns.
    const now = this.still ? 0 : (performance.now() / 1000) % 3600;

    gl.uniformMatrix4fv(this.uniforms.u_matrix ?? null, false, this.matrix);
    gl.uniformMatrix4fv(this.uniforms.u_inverse ?? null, false, this.inverse);
    gl.uniform3f(
      this.uniforms.u_camera ?? null,
      this.camera[0],
      this.camera[1],
      this.camera[2],
    );
    gl.uniform1f(this.uniforms.u_time ?? null, now);
    gl.uniform1f(this.uniforms.u_flash ?? null, this.flash);
    gl.uniform3f(
      this.uniforms.u_cloud ?? null,
      this.cloud[0],
      this.cloud[1],
      this.cloud[2],
    );
    gl.uniform3f(
      this.uniforms.u_sun ?? null,
      this.sun[0],
      this.sun[1],
      this.sun[2],
    );
    gl.uniform1f(
      this.uniforms.u_steps ?? null,
      Math.max(10, Math.round(this.settings.steps * this.quality)),
    );
    gl.uniform1f(this.uniforms.u_fade ?? null, fade);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(this.uniforms.u_noise ?? null, 0);

    // The march emits premultiplied colour. Depth writes off: a translucent
    // volume must not hide the funnel behind it.
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);

    gl.bindVertexArray(null);
    gl.depthMask(true);

    this.keepTurning();
  }

  /**
   * Keep the funnels turning while the replay is paused.
   *
   * While it plays the map repaints every frame anyway. Paused, this asks for
   * a repaint at ~30 fps, and only while a funnel is actually on screen, so
   * an idle map with the tornadoes scrolled away costs nothing.
   */
  private keepTurning() {
    const map = this.map;
    if (this.still || !map || this.idleTimer || typeof document === "undefined")
      return;
    if (document.visibilityState !== "visible" || !this.onScreen(map)) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.expectedMs = IDLE_FRAME_MS + 1000 / 60;
      this.map?.triggerRepaint();
    }, IDLE_FRAME_MS);
  }

  /** Watch the interval between frames and move the quality with it. */
  private pace() {
    const now = performance.now();
    const dt = now - this.lastRender;
    const expected = this.expectedMs;
    this.lastRender = now;
    this.expectedMs = 1000 / 60;
    // Only a continuous run of frames says anything; a gap is just idleness.
    if (!(dt > 0 && dt < 250) || this.count === 0) return;
    if (dt > expected * 1.45) {
      this.slow += 1;
      this.fast = 0;
    } else if (dt < expected * 1.12) {
      this.fast += 1;
      this.slow = 0;
    }
    if (this.slow >= 6) {
      this.quality = Math.max(0.42, this.quality - 0.12);
      this.slow = 0;
    }
    if (this.fast >= 120) {
      this.quality = Math.min(1, this.quality + 0.06);
      this.fast = 0;
    }
  }

  private onScreen(map: MapLibreMap): boolean {
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let i = 0; i < this.count; i += 1) {
      const o = i * FLOATS_PER_INSTANCE;
      const lon = this.instances[o]! * 360 - 180;
      const y = 180 - this.instances[o + 1]! * 360;
      const lat =
        (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90;
      const p = map.project([lon, lat]);
      if (p.x > -200 && p.x < w + 200 && p.y > -300 && p.y < h + 200)
        return true;
    }
    return false;
  }

  /** How many funnels the last frame drew — for the performance readout. */
  get drawn(): number {
    return this.count;
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 4x4 inverse, column-major, in doubles. */
export function invert(m: ArrayLike<number>, out: Float64Array): boolean {
  const a00 = m[0]!,
    a01 = m[1]!,
    a02 = m[2]!,
    a03 = m[3]!;
  const a10 = m[4]!,
    a11 = m[5]!,
    a12 = m[6]!,
    a13 = m[7]!;
  const a20 = m[8]!,
    a21 = m[9]!,
    a22 = m[10]!,
    a23 = m[11]!;
  const a30 = m[12]!,
    a31 = m[13]!,
    a32 = m[14]!,
    a33 = m[15]!;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return false;
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return true;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // A silent shader failure is an invisible layer, indistinguishable from
    // "the feature is off" — so say it out loud.
    console.error(
      "Funnel shader failed to compile:",
      gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram | null {
  const v = compile(gl, gl.VERTEX_SHADER, vert);
  const f = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!v || !f) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "Funnel program failed to link:",
      gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
