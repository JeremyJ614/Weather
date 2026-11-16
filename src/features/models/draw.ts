import {
  cityValues,
  loadFieldFrom,
  paintIndex,
  pngFile,
  pngRows,
  type Recipe,
} from "@/lib/models/core";
import type { Field } from "@/lib/models/grib2";

/** One frame to draw: the model file (its .idx sits next to it), the field and the box. */
export type FrameJob = {
  id: number;
  url: string;
  recipe: Recipe;
  colors: string[];
  box: number[];
  width: number;
  /** Also return the city values (a full frame, not a zoomed redraw). */
  cities: boolean;
};

const get = (url: string, init?: RequestInit) => fetch(url, init);

// The last few fields read, so a zoomed redraw reuses the frame's download.
const fields = new Map<string, Promise<Field>>();
function field(url: string, r: Recipe) {
  const k = `${url}|${r.key}`;
  let f = fields.get(k);
  if (!f) {
    f = loadFieldFrom(get, [url], r);
    fields.set(k, f);
    f.catch(() => fields.delete(k));
    while (fields.size > 3) fields.delete(fields.keys().next().value!);
  }
  return f;
}

/** zlib-wrapped deflate, by the browser's own compressor where it has one. */
export async function deflate(raw: Uint8Array) {
  if (typeof CompressionStream === "function") {
    const s = new Blob([raw as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  return stored(raw);
}

/** zlib stream of uncompressed blocks: bigger, but every browser can show it. */
function stored(raw: Uint8Array) {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blocks; b++) {
    const part = raw.subarray(b * 65535, (b + 1) * 65535);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = part.length & 255;
    out[o++] = part.length >> 8;
    out[o++] = ~part.length & 255;
    out[o++] = (~part.length >> 8) & 255;
    out.set(part, o);
    o += part.length;
  }
  let a = 1;
  let s = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    s = (s + a) % 65521;
  }
  const sum = ((s << 16) | a) >>> 0;
  out.set([sum >>> 24, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255], o);
  return out;
}

/** Reads the field from NOAA and draws it as a palette PNG (in the worker, or on the page). */
export async function drawJob(j: Omit<FrameJob, "id">) {
  const f = await field(j.url, j.recipe);
  const { idx, pal, w, h } = paintIndex(f, j.recipe, j.colors, j.box, j.width);
  const bytes = pngFile(w, h, pal, await deflate(pngRows(w, h, idx)));
  return {
    png: new Blob([bytes as BlobPart], { type: "image/png" }),
    cities: j.cities ? cityValues(f, j.recipe) : null,
  };
}
