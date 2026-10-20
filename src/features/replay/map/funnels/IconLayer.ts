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
import { PAL } from "@/features/replay/palette";
import { characterOf, lifeAt } from "./lifecycle";
import { EARTH_CIRCUMFERENCE, mercatorX, mercatorY } from "./mercator";
import { EF_SPIN } from "./shaders";
import { ICON_FRAG, ICON_VERT } from "./iconShaders";
import { reportError } from "@/features/replay/report";

/**
 * The spinning tornado icon (#5): every tornado on the ground, drawn flat on
 * the map in one instanced call. See iconShaders.ts for the drawing.
 *
 * Sized in screen pixels, not metres, so a tornado reads at any zoom — never
 * smaller than its rating's minimum, never smaller than its own surveyed
 * width. Tilted into 3D it shrinks to the tornado's real footprint and sits
 * under the funnel as its ground swirl.
 */

const FLOATS = 11; // pos(2) look(4) colour(4) flash(1)
const MAX = 96;
const RANK: Record<string, number> = {
  EFU: 0,
  EF0: 0,
  EF1: 1,
  EF2: 2,
  EF3: 3,
  EF4: 4,
  EF5: 5,
};
const IDLE_FRAME_MS = 33;

export class IconLayer implements CustomLayerInterface {
  readonly id = "tornado-icons";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private corners: WebGLBuffer | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly data = new Float32Array(FLOATS * MAX);
  private readonly matrix = new Float32Array(16);
  private count = 0;
  private builtZoom = NaN;
  private builtGround = NaN;

  private tornadoes: readonly PreparedTornado[] = [];
  private at = 0;
  private enabled = true;

  private readonly still =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  setFrame(
    tornadoes: readonly PreparedTornado[],
    at: number,
    enabled: boolean,
  ) {
    this.tornadoes = tornadoes;
    this.at = at;
    this.enabled = enabled;
    this.build();
    this.map?.triggerRepaint();
  }

  /** 0 flat, 1 tilted — the same band the funnels fade in over. */
  private ground(): number {
    const p = this.map?.getPitch() ?? 0;
    const t = Math.min(1, Math.max(0, (p - 14) / 18));
    return t * t * (3 - 2 * t);
  }

  private build() {
    const map = this.map;
    this.builtZoom = map?.getZoom() ?? NaN;
    this.builtGround = this.ground();
    this.count = 0;
    if (!this.enabled || !map) return;
    const zoom = this.builtZoom;
    const g = this.builtGround;
    let n = 0;
    // Strongest last, so it draws on top where icons overlap.
    const list = [...this.tornadoes].sort(
      (a, b) => (RANK[a.ef] ?? 0) - (RANK[b.ef] ?? 0),
    );
    for (const t of list) {
      if (n >= MAX) break;
      const ch = characterOf(t.ef);
      const life = lifeAt(
        t.start,
        t.end,
        this.at,
        ch,
        performance.now() / 1000,
      );
      if (life.phase === "before" || life.phase === "after") continue;
      const when = Math.max(t.start, this.at);
      const [lat, lon] = tornadoPositionAt(t, when);
      const mpp =
        (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) /
        (512 * 2 ** zoom);
      const rank = RANK[t.ef] ?? 0;
      const trueR = (widthAt(t, when) * 0.9144) / 2 / mpp;
      // Flat: at least the rating's own size, never smaller than the survey.
      const flatR = Math.min(150, Math.max(trueR * 1.1, 15 + 3.4 * rank));
      // Tilted: the real footprint, under the funnel.
      const groundR = Math.min(150, Math.max(trueR * 1.25, 9));
      const grow = life.phase === "forming" ? 0.35 + 0.65 * life.reach : 1;
      const radius = (flatR + (groundR - flatR) * g) * grow;
      const [r, gg, b] = rgb(PAL.ef[t.ef] ?? PAL.ef.EFU);

      const o = n * FLOATS;
      this.data[o] = mercatorX(lon);
      this.data[o + 1] = mercatorY(lat);
      this.data[o + 2] = radius;
      this.data[o + 3] = life.intensity;
      this.data[o + 4] = 0.8 + 0.45 * (EF_SPIN[t.ef] ?? 1);
      this.data[o + 5] = ((t.index * 2654435761) % 1000) / 1000;
      this.data[o + 6] = r;
      this.data[o + 7] = gg;
      this.data[o + 8] = b;
      this.data[o + 9] = rank / 5;
      this.data[o + 10] = life.flash;
      n += 1;
    }
    this.count = n;
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const program = link(gl, ICON_VERT, ICON_FRAG);
    if (!program) return;
    this.program = program;
    for (const u of ["u_matrix", "u_pxToMerc", "u_time", "u_ground"])
      this.uniforms[u] = gl.getUniformLocation(program, u);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const c = gl.getAttribLocation(program, "a_corner");
    gl.enableVertexAttribArray(c);
    gl.vertexAttribPointer(c, 2, gl.FLOAT, false, 0, 0);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const attrib = (name: string, size: number, off: number) => {
      const loc = gl.getAttribLocation(program, name);
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    attrib("a_pos", 2, 0);
    attrib("a_look", 4, 2);
    attrib("a_colour", 4, 6);
    attrib("a_flash", 1, 10);
    gl.bindVertexArray(null);
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.corners) gl.deleteBuffer(this.corners);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.program = null;
    this.vao = null;
    this.corners = null;
    this.buffer = null;
    this.map = null;
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
    // Size is in pixels and the footprint depends on the tilt: follow both.
    if (
      Math.abs(map.getZoom() - this.builtZoom) > 0.02 ||
      Math.abs(this.ground() - this.builtGround) > 0.02
    )
      this.build();
    if (this.count === 0) return;

    const src = options.defaultProjectionData
      .mainMatrix as unknown as ArrayLike<number>;
    for (let i = 0; i < 16; i += 1) this.matrix[i] = src[i] as number;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.data.subarray(0, this.count * FLOATS),
    );
    gl.uniformMatrix4fv(this.uniforms.u_matrix ?? null, false, this.matrix);
    gl.uniform1f(
      this.uniforms.u_pxToMerc ?? null,
      1 / (512 * 2 ** map.getZoom()),
    );
    gl.uniform1f(
      this.uniforms.u_time ?? null,
      this.still ? 0 : (performance.now() / 1000) % 3600,
    );
    gl.uniform1f(this.uniforms.u_ground ?? null, this.builtGround);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);

    this.keepTurning();
  }

  /** Keep spinning while paused: ~30 fps, only while an icon is on screen. */
  private keepTurning() {
    const map = this.map;
    if (this.still || !map || this.idleTimer || typeof document === "undefined")
      return;
    if (document.visibilityState !== "visible") return;
    const canvas = map.getCanvas();
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    let seen = false;
    for (let i = 0; i < this.count && !seen; i += 1) {
      const o = i * FLOATS;
      const lon = this.data[o]! * 360 - 180;
      const lat =
        (Math.atan(Math.sinh(Math.PI * (1 - 2 * this.data[o + 1]!))) * 180) /
        Math.PI;
      const p = map.project([lon, lat]);
      seen = p.x > -150 && p.x < w + 150 && p.y > -150 && p.y < h + 150;
    }
    if (!seen) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.map?.triggerRepaint();
    }, IDLE_FRAME_MS);
  }

  get drawn(): number {
    return this.count;
  }
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  const n = parseInt(v, 16);
  if (!Number.isFinite(n)) return [0.6, 0.63, 0.65];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
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
    console.error(
      "Tornado icon shader failed to compile:",
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
      "Tornado icon program failed to link:",
      gl.getProgramInfoLog(program),
    );
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
