/**
 * Radar, decoded from the archive and coloured on the GPU.
 *
 * The shape of it: fetch IEM's archived composite tiles for the visible area,
 * reverse their palette to recover the reflectivity each pixel actually
 * carries, upload that as a one-byte-per-pixel texture, and colour it in the
 * fragment shader from a palette built for chasing rather than for forecasting.
 *
 * Nothing is fetched until `load()` is called. That is not an implementation
 * detail — the owner's requirement is that radar is never automatic, and the
 * layer being on the map is not the same as the layer having asked anyone for
 * anything.
 */
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import { chaserStops, decodeTile } from "./decode";
import { tileUrl } from "./source";
import { reportError } from "@/features/replay/report";

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;       // 0..1 across the tile
uniform mat4 u_matrix;
uniform vec4 u_bounds;                       // west, north, east, south in mercator
out vec2 v_uv;
void main() {
  v_uv = vec2(a_corner.x, a_corner.y);
  vec2 merc = vec2(
    mix(u_bounds.x, u_bounds.z, a_corner.x),
    mix(u_bounds.y, u_bounds.w, a_corner.y)
  );
  gl_Position = u_matrix * vec4(merc, 0.0, 1.0);
}`;

/**
 * The palette, evaluated in the shader rather than looked up in a texture.
 *
 * It was a 256-pixel texture first, and the layer decoded its tiles perfectly,
 * drew its quads in the right place, and put nothing on the screen: every
 * palette read came back with zero alpha. Rather than keep hunting an upload
 * that measured correct on the CPU and wrong on the GPU, the ramp is
 * evaluated directly — nine comparisons, once per fragment, on hardware that
 * does this for a living.
 *
 * It is also simply better. There is no upload, no filtering mode to get
 * wrong, no alignment, and no second texture unit to bind — and the ramp is
 * generated from CHASER_STOPS at module load, so the legend beside the map
 * and the pixels on it cannot drift apart.
 */
function rampGlsl(): string {
  const CHASER_STOPS = chaserStops();
  const lines: string[] = [];
  for (let i = 0; i < CHASER_STOPS.length - 1; i += 1) {
    const [d0, r0, g0, b0, a0] = CHASER_STOPS[i]!;
    const [d1, r1, g1, b1, a1] = CHASER_STOPS[i + 1]!;
    const f = (n: number) => n.toFixed(4);
    lines.push(
      `  if (dbz < ${f(d1)}) return mix(` +
        `vec4(${f(r0 / 255)}, ${f(g0 / 255)}, ${f(b0 / 255)}, ${f(a0)}), ` +
        `vec4(${f(r1 / 255)}, ${f(g1 / 255)}, ${f(b1 / 255)}, ${f(a1)}), ` +
        `clamp((dbz - ${f(d0)}) / ${f(d1 - d0)}, 0.0, 1.0));`,
    );
  }
  const last = CHASER_STOPS[CHASER_STOPS.length - 1]!;
  lines.push(
    `  return vec4(${(last[1] / 255).toFixed(4)}, ${(last[2] / 255).toFixed(4)}, ` +
      `${(last[3] / 255).toFixed(4)}, ${last[4].toFixed(4)});`,
  );
  return lines.join("\n");
}

const frag = () => `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_data;                    // one byte per pixel: the palette index
uniform float u_opacity;
out vec4 fragColor;

vec4 chaser(float dbz) {
${rampGlsl()}
}

void main() {
  // The measurement, straight off the texture. Nearest, never linear: these
  // are palette indices, and the average of index 40 and index 200 is index
  // 120, which is a reflectivity neither pixel had.
  float idx = texture(u_data, v_uv).r;

  // Index 0 means nothing was there. Interpolating towards it along the edge
  // of a storm would draw a rim of light rain that is not in the data, so it
  // is discarded rather than blended.
  if (idx < 0.002) discard;

  // The index carries the measurement: dBZ = -32 + 0.5 x index.
  float dbz = -32.0 + 0.5 * (idx * 255.0);
  vec4 c = chaser(dbz);
  if (c.a < 0.004) discard;

  // Premultiplied, to match how the map composites everything else.
  float a = c.a * u_opacity;
  fragColor = vec4(c.rgb * a, a);
}`;

/** Web-mercator x/y in 0..1, which is what MapLibre's matrix expects. */
function mercator(lon: number, lat: number): [number, number] {
  const x = (180 + lon) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [x, y];
}

interface Tile {
  key: string;
  z: number;
  x: number;
  y: number;
  bounds: [number, number, number, number];
  texture: WebGLTexture | null;
  state: "loading" | "ready" | "empty" | "failed";
}

export interface RadarSettings {
  opacity: number;
  /** Which zoom to fetch at. Higher is sharper and costs more tiles. */
  zoom: number;
}

export const DEFAULT_RADAR: RadarSettings = { opacity: 0.68, zoom: 7 };

export class RadarLayer implements CustomLayerInterface {
  readonly id = "radar";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private tiles = new Map<string, Tile>();
  private settings: RadarSettings = { ...DEFAULT_RADAR };
  private generation = 0;

  /** What the interface shows while a fetch is in flight. */
  onProgress: ((loaded: number, total: number) => void) | null = null;

  setSettings(next: Partial<RadarSettings>) {
    this.settings = { ...this.settings, ...next };
    this.map?.triggerRepaint();
  }

  /** Counts render calls and drawn quads, so "nothing on screen" can be diagnosed. */
  stats = {
    renders: 0,
    drawn: 0,
    tiles: 0,
    ready: 0,
    decoded: [] as {
      key: string;
      of: number;
      withData: number;
      maxDbz: number | null;
    }[],
  };

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.gl = gl;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // A shader that will not compile draws nothing, and nothing looks
        // exactly like "no radar here" — so it says so out loud.
        console.error("[radar] shader failed:", gl.getShaderInfoLog(sh));
      }
      return sh;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag()));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[radar] link failed:", gl.getProgramInfoLog(program));
    }
    this.program = program;

    for (const name of ["u_matrix", "u_bounds", "u_data", "u_opacity"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
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
    this.clear();
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
  }

  /** Drop every tile. Called when the moment changes or radar is turned off. */
  clear() {
    const gl = this.gl;
    for (const t of this.tiles.values()) {
      if (t.texture && gl) gl.deleteTexture(t.texture);
    }
    this.tiles.clear();
    this.stats.decoded = [];
    this.generation += 1;
    this.map?.triggerRepaint();
  }

  /**
   * Go and get the radar for a moment. Nothing happens until this is called.
   *
   * Returns how many tiles carried anything, so the interface can say "no
   * radar was recorded here" rather than leaving someone looking at a map
   * they think is broken.
   */
  async load(
    epochSeconds: number,
  ): Promise<{ tiles: number; withData: number }> {
    const map = this.map;
    if (!map) return { tiles: 0, withData: 0 };

    this.clear();
    const mine = this.generation;

    const z = this.settings.zoom;
    const b = map.getBounds();
    const n = 2 ** z;
    const xOf = (lon: number) => Math.floor(((lon + 180) / 360) * n);
    const yOf = (lat: number) => {
      const r = (lat * Math.PI) / 180;
      return Math.floor(
        ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
      );
    };

    const x0 = Math.max(0, xOf(b.getWest()));
    const x1 = Math.min(n - 1, xOf(b.getEast()));
    const y0 = Math.max(0, yOf(b.getNorth()));
    const y1 = Math.min(n - 1, yOf(b.getSouth()));

    const wanted: { z: number; x: number; y: number }[] = [];
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) wanted.push({ z, x, y });
    }
    // A wide view at a high zoom is hundreds of tiles off somebody else's
    // server. Bounded rather than trusted.
    const capped = wanted.slice(0, 64);

    let done = 0;
    let withData = 0;
    await Promise.all(
      capped.map(async ({ x, y }) => {
        const tile = await this.fetchTile(epochSeconds, z, x, y, mine);
        done += 1;
        if (tile) withData += 1;
        this.onProgress?.(done, capped.length);
        this.map?.triggerRepaint();
      }),
    );

    return { tiles: capped.length, withData };
  }

  private async fetchTile(
    epoch: number,
    z: number,
    x: number,
    y: number,
    mine: number,
  ): Promise<boolean> {
    const key = `${z}/${x}/${y}`;
    const n = 2 ** z;
    const lonOf = (tx: number) => (tx / n) * 360 - 180;
    const latOf = (ty: number) => {
      const r = Math.PI - (2 * Math.PI * ty) / n;
      return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(r) - Math.exp(-r)));
    };
    const [wx, ny] = mercator(lonOf(x), latOf(y));
    const [ex, sy] = mercator(lonOf(x + 1), latOf(y + 1));

    const tile: Tile = {
      key,
      z,
      x,
      y,
      bounds: [wx, ny, ex, sy],
      texture: null,
      state: "loading",
    };
    this.tiles.set(key, tile);

    try {
      const res = await fetch(tileUrl(epoch, z, x, y), { mode: "cors" });
      if (!res.ok) {
        tile.state = "empty";
        return false;
      }
      const blob = await res.blob();

      /*
       * Decoded byte-exact, which takes saying so twice.
       *
       * This reads pixels back to recover a palette index, so a colour that
       * drifts by one is not a slightly different colour — it is a different
       * measurement, or none. Both the decoder and the canvas will quietly
       * alter it unless told not to: `createImageBitmap` colour-manages and
       * premultiplies by default, and a 2D context will convert to its own
       * colour space on the way in.
       *
       * With the defaults, about one pixel in forty still matched the palette
       * and the rest decoded as no data, so a storm arrived as a scatter of
       * stray returns at thirty below.
       */
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });

      /*
       * The size, taken before the bitmap is closed.
       *
       * `ImageBitmap.close()` releases the image and its width and height
       * both become 0 — so reading them afterwards to size the texture
       * uploads a 0x0 one. Everything upstream still looks perfect: the tile
       * fetches, the palette reverses, the decode reports thirty-five
       * thousand pixels of returns up to 71 dBZ, the quads draw in exactly
       * the right place. The texture is simply empty, so every sample is
       * zero, so every fragment is discarded, so the map is blank.
       */
      const tw = bitmap.width;
      const th = bitmap.height;

      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
        colorSpace: "srgb",
      });
      if (!ctx) {
        tile.state = "failed";
        return false;
      }
      ctx.drawImage(bitmap, 0, 0);
      const rgba = ctx.getImageData(0, 0, tw, th, { colorSpace: "srgb" }).data;
      bitmap.close();

      const data = decodeTile(rgba);
      let withData = 0;
      let maxIndex = 0;
      for (let i = 0; i < data.length; i += 1) {
        if (data[i]! > 0) {
          withData += 1;
          if (data[i]! > maxIndex) maxIndex = data[i]!;
        }
      }
      this.stats.decoded.push({
        key,
        of: data.length,
        withData,
        maxDbz: maxIndex ? -32 + 0.5 * maxIndex : null,
      });
      if (withData === 0) {
        tile.state = "empty";
        return false;
      }

      // The view may have moved on while this was in flight.
      if (mine !== this.generation) return false;
      const gl = this.gl;
      if (!gl) return false;

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        tw,
        th,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        data,
      );
      // NEAREST, deliberately: see the shader. These are indices, not colours.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      tile.texture = tex;
      tile.state = "ready";
      return true;
    } catch {
      tile.state = "failed";
      return false;
    }
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
    this.stats.renders += 1;
    this.stats.tiles = this.tiles.size;
    this.stats.ready = [...this.tiles.values()].filter(
      (t) => t.state === "ready",
    ).length;
    if (!this.program || !this.vao || this.tiles.size === 0) return;

    /*
     * mainMatrix, not modelViewProjectionMatrix — the same trap the funnel
     * layer documents. mainMatrix projects spherical mercator, which is the
     * space these tile bounds are in.
     */
    const src = options.defaultProjectionData
      .mainMatrix as unknown as ArrayLike<number>;
    const matrix = src instanceof Float32Array ? src : new Float32Array(src);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniformMatrix4fv(this.uniforms.u_matrix!, false, matrix);
    gl.uniform1f(this.uniforms.u_opacity!, this.settings.opacity);

    /*
     * State is borrowed, and has to be given back.
     *
     * A custom layer runs in the middle of MapLibre's own rendering, so
     * anything it changes and leaves changed breaks whatever draws next. I
     * learned this the direct way: turning the stencil test off to debug this
     * layer left MapLibre's tile clipping off for every layer after it, and
     * the warning polygons went from an outline to a solid wash across half
     * the map. The stencil is not touched at all now, and everything else is
     * restored below.
     */
    const hadCull = gl.isEnabled(gl.CULL_FACE);
    const hadDepth = gl.isEnabled(gl.DEPTH_TEST);

    gl.enable(gl.BLEND);
    // Premultiplied, matching what the fragment shader emits.
    gl.blendFuncSeparate(
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    /*
     * Face culling off while this draws.
     *
     * MapLibre leaves CULL_FACE enabled from its own passes, and this quad's
     * winding after projection depends on the camera — mercator y grows
     * southward and the projection flips it, so the strip can come out
     * back-facing and every fragment is thrown away before the shader runs.
     * The symptom is a layer that loads its tiles, reports them ready, issues
     * its draw calls and puts nothing on the screen.
     */
    gl.disable(gl.CULL_FACE);

    for (const tile of this.tiles.values()) {
      if (tile.state !== "ready" || !tile.texture) continue;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tile.texture);
      gl.uniform1i(this.uniforms.u_data!, 0);
      gl.uniform4f(this.uniforms.u_bounds!, ...tile.bounds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.drawn += 1;
    }

    gl.depthMask(true);
    if (hadCull) gl.enable(gl.CULL_FACE);
    if (hadDepth) gl.enable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
  }
}
