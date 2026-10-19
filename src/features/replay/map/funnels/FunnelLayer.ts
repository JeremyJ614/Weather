import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  tornadoPositionAt,
  type PreparedTornado,
} from "@/features/replay/core/chase";
import { characterOf, lifeAt } from "./lifecycle";
import { metresToMercator, mercatorX, mercatorY } from "./mercator";
import { EF_SPIN, FUNNEL_FRAG, FUNNEL_VERT } from "./shaders";
import { buildNoise3D, NOISE_SIZE } from "./noise3d";

/**
 * Every tornado on the ground, in one draw call (Z2 #09).
 *
 * Instancing is the change that makes the rest affordable. 27 April 2011 puts
 * more than thirty tornadoes on the ground at once and the archive holds 207
 * across the day; a marker or a sprite each means a draw call each, and the
 * budget is gone before any of them look like anything. One quad, one buffer
 * upload per frame, one `drawArraysInstanced` — after which the per-funnel
 * cost is a few floats, and everything spent on making them look right is
 * spent in the fragment shader where it belongs.
 */

const FLOATS_PER_INSTANCE = 16; // pos(2) shape(4) style(4) life(4) extra(2)

export interface FunnelSettings {
  /** Off entirely, for the performance preset. */
  enabled: boolean;
  /** Cap, so a 200-tornado day cannot melt a phone. */
  maxFunnels: number;
  /** Multiplier on the drawn height — taste, not data. */
  heightScale: number;
  /**
   * Raymarch steps per pixel.
   *
   * The one honest performance dial. 24 with dithering looks like 64; 12 is
   * visibly grainier but still volumetric, and is what the performance preset
   * uses. Deliberately NOT a resolution reduction — the spec this was built to
   * forbids that, and it is right to: a half-resolution funnel is blurry at
   * every step count, while a low step count is merely grainier.
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

  private instances = new Float32Array(
    FLOATS_PER_INSTANCE * DEFAULT_FUNNEL_SETTINGS.maxFunnels,
  );
  private count = 0;
  private flash = 0;
  /** Vertices in the bounding silhouette, set when the mesh is built. */
  private vertexCount = 6;

  private tornadoes: readonly PreparedTornado[] = [];
  private at = 0;
  private settings: FunnelSettings = DEFAULT_FUNNEL_SETTINGS;

  /**
   * The cloud base a funnel is read against (Z3 #21).
   *
   * A condensation funnel has almost no colour of its own — it is the cloud
   * base, stretched down and lit from the same sky. So the one thing that
   * decides whether a funnel looks like it belongs in a dusk frame or a
   * midday one is this, and it comes from the solar grade rather than being
   * the fixed grey it started as.
   */
  private cloud: [number, number, number] = [0.62, 0.64, 0.68];

  /**
   * The direction toward the sun, in the billboard's own space.
   *
   * x is across the billboard and y is into it, which is the plane the
   * raymarch's surface normals live in. Fed from the same solar model the sky
   * is graded with, so a funnel at dusk is lit from where the sun actually
   * was rather than from a fixed studio light.
   */
  private sun: [number, number, number] = [-0.7071, -0.7071, 0.3];

  private noiseTex: WebGLTexture | null = null;

  setCloud(rgb: readonly [number, number, number]) {
    this.cloud = [rgb[0], rgb[1], rgb[2]];
  }

  /** `azimuthDeg` clockwise from north, `altitudeDeg` above the horizon. */
  setSun(azimuthDeg: number, altitudeDeg: number, mapBearingDeg: number) {
    // Into the billboard's frame: the quad faces the camera, so the sun's
    // bearing relative to the camera is what decides which side is lit.
    const rel = ((azimuthDeg - mapBearingDeg) * Math.PI) / 180;
    const alt = (Math.max(-10, altitudeDeg) * Math.PI) / 180;
    const horiz = Math.cos(alt);
    this.sun = [Math.sin(rel) * horiz, -Math.cos(rel) * horiz, Math.sin(alt)];
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
    }
    this.settings = settings;
    this.build();
    this.map?.triggerRepaint();
  }

  /**
   * Fill the instance buffer for this moment.
   *
   * Kept out of `render` on purpose: render runs on MapLibre's schedule, which
   * is every frame the map moves, while the data only changes when the clock
   * does. Rebuilding here means panning a paused map costs nothing.
   */
  private build() {
    if (!this.settings.enabled) {
      this.count = 0;
      return;
    }

    const arr = this.instances;
    let n = 0;
    let flash = 0;

    // Strongest first, so the cap keeps the tornadoes worth looking at.
    const candidates = [...this.tornadoes].sort(
      (a, b) => b.widthYd - a.widthYd,
    );

    for (const t of candidates) {
      if (n >= this.settings.maxFunnels) break;
      const ch = characterOf(t.ef);
      const life = lifeAt(t.start, t.end, this.at, ch);
      if (life.phase === "before" || life.phase === "after") continue;

      // Where it is now. During the forming phase it has not started moving
      // along the survey yet, so it hangs above the touchdown point.
      const when = Math.max(t.start, this.at);
      const [lat, lon] = tornadoPositionAt(t, when);
      const perMetre = metresToMercator(lat);

      // The surveyed width is the truth; character scales the drawn column
      // around it so a rating still reads when the survey is coarse.
      const widthM =
        Math.max(t.widthYd * 0.9144, ch.baseWidthM * 0.35) * life.widthScale;

      /*
       * Everything the shader sees is measured in funnel heights.
       *
       * This is the one thing that has to be right or the funnel is visibly
       * squashed: the billboard's x axis and y axis must share a unit. The
       * fragment shader marches a volume where `y` runs 0..1 over the column's
       * height, so `x` has to be in the same units — otherwise a 1500 m tall
       * funnel drawn on a 400 m wide quad is stretched more than three times
       * sideways, which is exactly how the first attempt looked.
       *
       * So: radii as fractions of height, the quad sized from those radii, and
       * `X` handed to the shader so it can convert its own [-1,1] back into
       * height units.
       */
      const heightM = ch.heightM * this.settings.heightScale;
      const rb = Math.max(0.006, widthM / 2 / heightM);
      const rt = rb * 1.3 + 0.06;
      const rc = Math.min(rt * 1.9, rt + 0.2);
      // Wide enough for the widest of the body, the debris bowl and the flare.
      const bend = rb < 0.06 ? 0.05 : 0;
      const X =
        Math.max(rt * 1.5, (rb * 2.05 + 0.02) * 1.35, rc * 1.2) + bend + 0.02;

      const o = n * FLOATS_PER_INSTANCE;
      arr[o + 0] = mercatorX(lon);
      arr[o + 1] = mercatorY(lat);
      arr[o + 2] = X * heightM * perMetre; // billboard half-width, mercator
      arr[o + 3] = heightM * perMetre;
      arr[o + 4] = life.intensity;
      arr[o + 5] = life.tilt;
      arr[o + 6] = ch.opacity;
      arr[o + 7] = ch.darkness;
      arr[o + 8] = ch.debris;
      arr[o + 9] = ch.wobbleM * perMetre;
      // A stable per-tornado seed, so one does not shimmer differently each frame.
      arr[o + 10] = ((t.index * 2654435761) % 1000) / 1000;
      arr[o + 11] = life.reach;
      // Rotation rate by rating — an EF5 turns nearly four times an EF0's rate.
      arr[o + 12] = EF_SPIN[t.ef] ?? 1;
      arr[o + 13] = rb;
      arr[o + 14] = X;
      arr[o + 15] = bend;

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
      "u_bearing",
      "u_time",
      "u_cloud",
      "u_flash",
      "u_sun",
      "u_steps",
      "u_noise",
    ]) {
      this.uniforms[u] = gl.getUniformLocation(program, u);
    }

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    /*
     * The bounding silhouette, as a triangle strip expanded into triangles.
     *
     * Not a quad. The vertex shader pulls each row in to the funnel's own
     * rMax at that height, so the mesh traces the density boundary — which is
     * what stops the GPU rasterising the large empty corners beside a narrow
     * rope and then discarding them. A discarded fragment is cheap; not
     * generating it is cheaper, and on a phone that difference is the whole
     * budget for a volumetric effect.
     *
     * ROWS controls how closely the mesh follows the curve. 24 is past the
     * point where more rows change the silhouette: the vertex cost is
     * trivial (96 vertices per funnel) and the saving is in fragments.
     */
    const ROWS = 24;
    const verts: number[] = [];
    for (let i = 0; i < ROWS; i += 1) {
      const y0 = i / ROWS;
      const y1 = (i + 1) / ROWS;
      verts.push(-1, y0, 1, y0, -1, y1);
      verts.push(-1, y1, 1, y0, 1, y1);
    }
    this.vertexCount = verts.length / 2;

    this.cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, "a_corner");
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);

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
    attrib("a_shape", 4, 2);
    attrib("a_style", 4, 6);
    attrib("a_life", 4, 10);
    attrib("a_extra", 2, 14);

    gl.bindVertexArray(null);

    /*
     * The noise volume, built once.
     *
     * This is the optimisation that makes a volumetric funnel affordable: the
     * raymarch samples noise twice per step, twenty-odd steps per pixel, every
     * frame. Computed arithmetically that is hundreds of instructions in the
     * inner loop; as a texture lookup it is one, and the hardware's trilinear
     * filter does the interpolation for nothing.
     */
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
    // REPEAT is what lets the sampling coordinate wander without bound as the
    // column rotates and rises; the volume is built to tile so it never seams.
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
    }
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
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

  /** Scratch, so the per-frame matrix conversion allocates nothing. */
  private readonly matrix = new Float32Array(16);

  /**
   * Where instance 0 lands in clip space, for diagnosing an invisible layer.
   *
   * A custom layer that draws nothing gives no error: the geometry is simply
   * somewhere else. Being able to ask "where did it actually go" turns that
   * into a number.
   */
  probe(): Record<string, unknown> | null {
    if (this.count === 0) return null;
    const m = this.matrix;
    const [x, y, hw, h] = [
      this.instances[0]!,
      this.instances[1]!,
      this.instances[2]!,
      this.instances[3]!,
    ];
    const proj = (px: number, py: number, pz: number) => {
      const cx = m[0]! * px + m[4]! * py + m[8]! * pz + m[12]!;
      const cy = m[1]! * px + m[5]! * py + m[9]! * pz + m[13]!;
      const cw = m[3]! * px + m[7]! * py + m[11]! * pz + m[15]!;
      return cw === 0
        ? [NaN, NaN]
        : [+(cx / cw).toFixed(3), +(cy / cw).toFixed(3)];
    };
    return {
      count: this.count,
      merc: [+x.toFixed(6), +y.toFixed(6)],
      halfWidthMerc: hw,
      heightMerc: h,
      baseNDC: proj(x, y, 0),
      topNDC: proj(x, y, h),
      edgeNDC: proj(x + hw, y, 0),
      matrixZeroed: m.every((v) => v === 0),
    };
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
    if (!this.program || !this.vao || this.count === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.instances.subarray(0, this.count * FLOATS_PER_INSTANCE),
    );

    /**
     * `defaultProjectionData.mainMatrix`, not `modelViewProjectionMatrix`.
     *
     * The two are different spaces and only one takes mercator. MapLibre's own
     * documentation is explicit: mainMatrix projects spherical mercator, where
     * [0,0] is the top-left of the world and [1,1] the bottom-right, and with
     * renderingMode '3d' the z axis is conformal — a cube in mercator units
     * renders as a cube. That is the space every position here is built in.
     * modelViewProjectionMatrix converts from a *world* space that is not
     * mercator, so feeding it these coordinates puts every funnel somewhere
     * off screen, silently.
     *
     * It also arrives as a 64-bit matrix. uniformMatrix4fv takes Float32Array
     * only; a Float64Array is rejected and the uniform keeps whatever it had,
     * which is the identity — equally silent, equally invisible.
     */
    const src = options.defaultProjectionData
      .mainMatrix as unknown as ArrayLike<number>;
    for (let i = 0; i < 16; i += 1) this.matrix[i] = src[i] as number;
    gl.uniformMatrix4fv(this.uniforms.u_matrix ?? null, false, this.matrix);
    gl.uniform1f(
      this.uniforms.u_bearing ?? null,
      ((this.map?.getBearing() ?? 0) * Math.PI) / 180,
    );
    gl.uniform1f(this.uniforms.u_time ?? null, this.at);
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
    gl.uniform1f(this.uniforms.u_steps ?? null, this.settings.steps);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.noiseTex);
    gl.uniform1i(this.uniforms.u_noise ?? null, 0);

    /*
     * Premultiplied blending, because the raymarch emits premultiplied colour.
     *
     * The march accumulates colour already multiplied by coverage. Blending
     * that with SRC_ALPHA multiplies by coverage twice, which makes the funnel
     * both darker and more transparent than it should be at the same time.
     * ONE / ONE_MINUS_SRC_ALPHA is the matching function.
     *
     * Depth writes stay off: a translucent volume must not occlude the funnel
     * behind it.
     */
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.vertexCount, this.count);

    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  /** How many funnels the last frame drew — for the performance readout. */
  get drawn(): number {
    return this.count;
  }
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
    // Worth saying out loud: a silent shader failure is an invisible layer,
    // which is indistinguishable from "the feature is off".
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
