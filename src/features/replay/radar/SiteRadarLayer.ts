/**
 * One radar's own scan, drawn in its own geometry (#7).
 *
 * The mosaic layer draws squares of somebody else's picture. This draws the
 * measurements: each pixel on the map works out its bearing and distance from
 * the antenna, and reads the gate the radar measured there straight out of a
 * texture laid out azimuth by range. Nothing is resampled onto a grid first,
 * so the bins land exactly where the radar put them and a couplet a kilometre
 * across stays a kilometre across at any zoom.
 *
 * The products share that path and differ only in the last line: velocity is
 * coloured as measured, storm-relative velocity first subtracts the storm's
 * own motion along the beam, and correlation coefficient is masked to where
 * there is something to correlate.
 */
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { Moment } from "./level2/format";
import type { SiteScan } from "./level2/scan";
import type { Sweep } from "./level2/sweep";
import {
  ccStops,
  folded,
  reflectivityStops,
  velocityStops,
  rampFunction,
} from "./level2/palettes";
import { reportError } from "@/features/replay/report";

export type SiteProduct = "ref" | "vel" | "srv" | "cc";

/** Which moment each product draws. */
export const MOMENT_OF: Record<SiteProduct, Moment> = {
  ref: "REF",
  vel: "VEL",
  srv: "VEL",
  cc: "RHO",
};

const PRODUCT_CODE: Record<SiteProduct, number> = {
  ref: 0,
  vel: 1,
  srv: 2,
  cc: 3,
};

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
uniform mat4 u_matrix;
uniform vec4 u_bounds;   // west, north, east, south in mercator
out vec2 v_merc;
void main() {
  v_merc = vec2(mix(u_bounds.x, u_bounds.z, a_corner.x), mix(u_bounds.y, u_bounds.w, a_corner.y));
  gl_Position = u_matrix * vec4(v_merc, 0.0, 1.0);
}`;

/** Built when the layer is added, so it carries the admin's colors. */
const frag = (FOLDED = folded()) => `#version 300 es
precision highp float;
in vec2 v_merc;
uniform sampler2D u_data;
uniform sampler2D u_ref;
uniform vec4 u_geom;      // first gate m, spacing m, gates, rows
uniform vec2 u_code;      // scale, offset
uniform vec4 u_refGeom;
uniform vec2 u_refCode;
uniform float u_hasRef;
uniform vec4 u_site;      // lat, lon (degrees), 1 / cos(elevation), metres per pixel
uniform int u_product;    // 0 reflectivity, 1 velocity, 2 storm-relative, 3 correlation
uniform vec2 u_motion;    // storm motion, east and north, m/s
uniform float u_opacity;
uniform float u_smooth;   // 1 to blend between bins, 0 to draw them as measured
uniform float u_fold;     // m/s: velocity neighbours further apart than this are not blended
out vec4 fragColor;

const float PI = 3.14159265358979;
const float EARTH = 6371008.8;

${rampFunction("reflectivity", reflectivityStops())}
${rampFunction("velocity", velocityStops())}
${rampFunction("correlation", ccStops())}

// The byte the radar recorded at a slant range and bearing, or -1 outside the scan.
float codeAt(sampler2D tex, vec4 geom, float range, float az) {
  float g = floor((range - geom.x) / geom.y + 0.5);
  if (g < 0.0 || g >= geom.z) return -1.0;
  float row = mod(floor(az / (360.0 / geom.w)), geom.w);
  return floor(texelFetch(tex, ivec2(int(g), int(row)), 0).r * 255.0 + 0.5);
}

float fetchCode(int g, int row) {
  if (g < 0 || float(g) >= u_geom.z) return 0.0;
  return floor(texelFetch(u_data, ivec2(g, row), 0).r * 255.0 + 0.5);
}

/*
 * The value between four bins, weighted by distance, for the smooth look.
 * Only measured neighbours count — an empty bin is not a zero — and velocity
 * is never blended across a fold or a couplet's gate-to-gate jump: averaging
 * +25 and -25 would draw a calm grey exactly where the tornado is.
 */
float smoothValue(float range, float az, float nearest) {
  float gf = (range - u_geom.x) / u_geom.y;
  float rf = az / (360.0 / u_geom.w) - 0.5;
  float g0 = floor(gf), r0 = floor(rf);
  float fg = gf - g0, fr = rf - r0;
  int ra = int(mod(r0, u_geom.w)), rb = int(mod(r0 + 1.0, u_geom.w));
  float c[4];
  c[0] = fetchCode(int(g0), ra);
  c[1] = fetchCode(int(g0) + 1, ra);
  c[2] = fetchCode(int(g0), rb);
  c[3] = fetchCode(int(g0) + 1, rb);
  float w[4];
  w[0] = (1.0 - fg) * (1.0 - fr);
  w[1] = fg * (1.0 - fr);
  w[2] = (1.0 - fg) * fr;
  w[3] = fg * fr;
  float sum = 0.0, total = 0.0, lo = 1e9, hi = -1e9;
  for (int i = 0; i < 4; i += 1) {
    if (c[i] < 1.5) continue;
    float v = (c[i] - u_code.y) / u_code.x;
    sum += v * w[i];
    total += w[i];
    lo = min(lo, v);
    hi = max(hi, v);
  }
  if (total < 1e-4) return nearest;
  if ((u_product == 1 || u_product == 2) && hi - lo > u_fold) return nearest;
  return sum / total;
}

void main() {
  // Where this pixel is on the ground.
  float lon = v_merc.x * 360.0 - 180.0;
  float lat = degrees(atan(sinh(PI * (1.0 - 2.0 * v_merc.y))));

  // Bearing and great-circle distance from the antenna.
  float p1 = radians(u_site.x), p2 = radians(lat);
  float dl = radians(lon - u_site.y);
  float az = degrees(atan(sin(dl) * cos(p2), cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)));
  if (az < 0.0) az += 360.0;
  // Squared by hand: pow() is undefined for a negative base.
  float sp = sin((p2 - p1) * 0.5), sl = sin(dl * 0.5);
  float h = sp * sp + cos(p1) * cos(p2) * sl * sl;
  float ground = 2.0 * EARTH * asin(min(1.0, sqrt(h)));

  // The antenna itself: a small mark so it is clear where "towards" is.
  float px = ground / u_site.w;
  if (px < 5.0) {
    float edge = smoothstep(5.0, 3.5, px);
    float core = smoothstep(2.4, 1.2, px);
    vec3 c = mix(vec3(0.05), vec3(0.96), core);
    float a = edge * u_opacity;
    fragColor = vec4(c * a, a);
    return;
  }

  // Slant range along a beam this low is the ground distance over cos(elevation).
  float range = ground * u_site.z;
  float code = codeAt(u_data, u_geom, range, az);
  if (code < 1.5) {
    // 0 is "nothing measured". 1 is range folded, which only velocity shows.
    if (code > 0.5 && (u_product == 1 || u_product == 2)) {
      float a = ${FOLDED[3].toFixed(3)} * u_opacity;
      fragColor = vec4(vec3(${(FOLDED[0] / 255).toFixed(4)}, ${(FOLDED[1] / 255).toFixed(4)}, ${(FOLDED[2] / 255).toFixed(4)}) * a, a);
      return;
    }
    discard;
  }
  float v = (code - u_code.y) / u_code.x;
  if (u_smooth > 0.5) v = smoothValue(range, az, v);

  vec4 col;
  if (u_product == 0) {
    col = reflectivity(v);
  } else if (u_product == 3) {
    // Correlation means nothing where almost nothing came back.
    if (u_hasRef > 0.5) {
      float rc = codeAt(u_ref, u_refGeom, range, az);
      if (rc < 1.5 || (rc - u_refCode.y) / u_refCode.x < 10.0) discard;
    }
    col = correlation(v);
  } else {
    if (u_product == 2) {
      // Positive velocity is away from the radar; take away the storm's share of it.
      float b = radians(az);
      v -= dot(u_motion, vec2(sin(b), cos(b)));
    }
    col = velocity(v);
  }
  if (col.a < 0.004) discard;
  float a = col.a * u_opacity;
  fragColor = vec4(col.rgb * a, a);
}`;

/** Web-mercator x/y in 0..1. */
function mercator(lon: number, lat: number): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180);
  return [(180 + lon) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

interface Uploaded {
  sweep: Sweep;
  texture: WebGLTexture;
}

export class SiteRadarLayer implements CustomLayerInterface {
  readonly id = "radar-site";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private corners: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  private scan: SiteScan | null = null;
  private textures = new Map<Moment, Uploaded>();
  private product: SiteProduct = "vel";
  private motion: [number, number] = [0, 0];
  private opacity = 0.8;
  private smooth = true;

  /** The scan drawn now, or null. */
  get current(): SiteScan | null {
    return this.scan;
  }

  setScan(scan: SiteScan | null) {
    if (scan === this.scan) return;
    this.dropTextures();
    this.scan = scan;
    this.map?.triggerRepaint();
  }

  setProduct(p: SiteProduct) {
    this.product = p;
    this.map?.triggerRepaint();
  }
  /** Storm motion toward the east and north, in m/s. */
  setMotion(east: number, north: number) {
    this.motion = [east, north];
    this.map?.triggerRepaint();
  }
  setOpacity(o: number) {
    this.opacity = o;
    this.map?.triggerRepaint();
  }
  /** Blend between bins, or draw each exactly as measured. */
  setSmooth(on: boolean) {
    this.smooth = on;
    this.map?.triggerRepaint();
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;
    const program = link(gl, VERT, frag());
    if (!program) return;
    this.program = program;
    for (const u of [
      "u_matrix",
      "u_bounds",
      "u_data",
      "u_ref",
      "u_geom",
      "u_code",
      "u_refGeom",
      "u_refCode",
      "u_hasRef",
      "u_site",
      "u_product",
      "u_motion",
      "u_opacity",
      "u_smooth",
      "u_fold",
    ]) {
      this.uniforms[u] = gl.getUniformLocation(program, u);
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.corners = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.dropTextures();
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.corners) gl.deleteBuffer(this.corners);
    this.program = null;
    this.vao = null;
    this.corners = null;
    this.map = null;
    this.gl = null;
  }

  private dropTextures() {
    const gl = this.gl;
    if (gl) for (const t of this.textures.values()) gl.deleteTexture(t.texture);
    this.textures.clear();
  }

  private textureFor(gl: WebGL2RenderingContext, m: Moment): Uploaded | null {
    const hit = this.textures.get(m);
    if (hit) return hit;
    const sweep = this.scan?.sweeps[m];
    if (!sweep) return null;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      sweep.gates,
      sweep.rows,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      sweep.data,
    );
    // Codes, not colours: never blended.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const up = { sweep, texture };
    this.textures.set(m, up);
    return up;
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
    const scan = this.scan;
    if (!this.program || !this.vao || !map || !scan) return;
    const data = this.textureFor(gl, MOMENT_OF[this.product]);
    if (!data) return;
    const ref = this.product === "cc" ? this.textureFor(gl, "REF") : null;
    const s = data.sweep;

    // A box round everything the scan reaches.
    const reach = s.first + s.spacing * (s.gates + 1);
    const dLat = reach / 111_195;
    const edgeLat = Math.min(85, Math.abs(scan.lat) + dLat);
    const dLon = reach / (111_195 * Math.cos((edgeLat * Math.PI) / 180));
    const [west, north] = mercator(
      scan.lon - dLon,
      Math.min(85, scan.lat + dLat),
    );
    const [east, south] = mercator(
      scan.lon + dLon,
      Math.max(-85, scan.lat - dLat),
    );

    const src = options.defaultProjectionData
      .mainMatrix as unknown as ArrayLike<number>;
    const matrix = src instanceof Float32Array ? src : new Float32Array(src);
    const zoom = map.getZoom();
    const metresPerPixel =
      (40_075_016.7 * Math.cos((scan.lat * Math.PI) / 180)) / (512 * 2 ** zoom);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    const u = this.uniforms;
    gl.uniformMatrix4fv(u.u_matrix ?? null, false, matrix);
    gl.uniform4f(u.u_bounds ?? null, west, north, east, south);
    gl.uniform4f(u.u_geom ?? null, s.first, s.spacing, s.gates, s.rows);
    gl.uniform2f(u.u_code ?? null, s.scale, s.offset);
    gl.uniform4f(
      u.u_site ?? null,
      scan.lat,
      scan.lon,
      1 / Math.cos((s.angle * Math.PI) / 180),
      metresPerPixel,
    );
    gl.uniform1i(u.u_product ?? null, PRODUCT_CODE[this.product]);
    gl.uniform2f(u.u_motion ?? null, this.motion[0], this.motion[1]);
    gl.uniform1f(u.u_opacity ?? null, this.opacity);
    gl.uniform1f(u.u_smooth ?? null, this.smooth ? 1 : 0);
    // Neighbours further apart than the folding speed are a fold or a couplet, not the same air.
    gl.uniform1f(u.u_fold ?? null, s.nyquist ? s.nyquist : 20);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, data.texture);
    gl.uniform1i(u.u_data ?? null, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, (ref ?? data).texture);
    gl.uniform1i(u.u_ref ?? null, 1);
    const r = (ref ?? data).sweep;
    gl.uniform4f(u.u_refGeom ?? null, r.first, r.spacing, r.gates, r.rows);
    gl.uniform2f(u.u_refCode ?? null, r.scale, r.offset);
    gl.uniform1f(u.u_hasRef ?? null, ref ? 1 : 0);

    // Borrowed state, given back: see RadarLayer for the stories behind each line.
    const hadCull = gl.isEnabled(gl.CULL_FACE);
    const hadDepth = gl.isEnabled(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true);
    if (hadCull) gl.enable(gl.CULL_FACE);
    if (hadDepth) gl.enable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
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
    console.error("[radar-site] shader failed:", gl.getShaderInfoLog(shader));
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
    console.error("[radar-site] link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export { frag as siteFrag, VERT as SITE_VERT };
