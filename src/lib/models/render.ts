import "server-only";
import { deflateSync } from "node:zlib";
import { pick, type Colors } from "@/lib/colors/pick";
import { MODEL_CITIES } from "./cities";
import {
  decodeGrib2,
  gridSize,
  locator,
  rowLocator,
  type Field,
} from "./grib2";
import { GFS, HRRR, REFS, SCALES, type Param } from "./params";

/**
 * Model maps rendered on demand from NOAA's own GRIB2 files: the viewer asks for one
 * field at one forecast hour, we read the file's .idx, fetch just that record with an
 * HTTP Range request (a few hundred KB of a 100+ MB file), decode it, and paint it into a
 * transparent Web-Mercator PNG for the map. Frames are immutable per run, so the CDN
 * keeps each one after the first request.
 *
 * The look (owner, 2026-11-02, after Max Velocity's HRRR pages): continuous shading, the color
 * gliding between the field's levels instead of filling flat bands, so every gradient and the
 * terrain's fingerprints show at the model's full 3 km detail. The field is sampled with a
 * clamped Catmull-Rom (smooth through the grid, never past a real value), which is what turns
 * GFS's 25 km cells from a mosaic into a smooth map. Frames are palette PNGs: 240 shades along
 * the field's ramp, about a fifth the size of full color.
 */
export type ModelId = "hrrr" | "gfs" | "refs";
type Def = {
  label: string;
  res: string;
  params: Param[];
  cycles: number[];
  hours: number[];
  /** The file for a forecast hour (`file`: an ensemble's product file, see Param.file). */
  url: (ymd: string, hh: string, fh: number, file?: string) => string;
  /** Where to look when `url` has nothing (REFS: NOAA's parallel feed, before it goes live). */
  alt?: (ymd: string, hh: string, fh: number, file?: string) => string;
};
const REFS_URL =
  (env: string) =>
  (d: string, h: string, f: number, file = "prob") =>
    `https://nomads.ncep.noaa.gov/pub/data/nccf/com/refs/${env}/refs.${d}/${h}/ensprod/refs.t${h}z.${file}.f${String(f).padStart(2, "0")}.conus.grib2`;

export const MODELS: Record<ModelId, Def> = {
  hrrr: {
    label: "HRRR",
    res: "3 km · hourly",
    params: HRRR,
    cycles: Array.from({ length: 24 }, (_, i) => i),
    hours: Array.from({ length: 19 }, (_, i) => i),
    url: (d, h, f) =>
      `https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.${d}/conus/hrrr.t${h}z.wrfsfcf${String(f).padStart(2, "0")}.grib2`,
  },
  gfs: {
    label: "GFS",
    res: "25 km · 6-hourly",
    params: GFS,
    cycles: [0, 6, 12, 18],
    hours: Array.from({ length: 21 }, (_, i) => i * 6),
    url: (d, h, f) =>
      `https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.${d}/${h}/atmos/gfs.t${h}z.pgrb2.0p25.f${String(f).padStart(3, "0")}`,
  },
  // HREF retires when REFS goes operational (NWS SCN 26-47/26-48, Fix list 2026-10-30 #8).
  refs: {
    label: "REFS Ensemble",
    res: "3 km · 14 members",
    params: REFS,
    cycles: [0, 6, 12, 18],
    hours: Array.from({ length: 24 }, (_, i) => i * 2 + 1),
    url: REFS_URL("prod"),
    alt: REFS_URL("para"),
  },
};

/** Map regions (west, south, east, north), VIP's set. */
export const REGIONS: Record<string, { label: string; b: number[] }> = {
  conus: { label: "CONUS", b: [-125, 23, -66, 50] },
  west: { label: "West", b: [-125, 31, -102, 49.5] },
  nplains: { label: "N. Plains", b: [-108, 39, -89, 49.5] },
  splains: { label: "S. Plains", b: [-107, 25.5, -89, 40.5] },
  midwest: { label: "Midwest", b: [-98, 36, -80, 49] },
  northeast: { label: "Northeast", b: [-84, 37, -66.5, 47.8] },
  southeast: { label: "Southeast", b: [-95, 24, -75, 37.5] },
};

/**
 * The box a region's frames are painted over. HRRR and REFS fill their own domain; GFS is
 * global, so its frames reach well past the view and no rectangle edge shows.
 */
export function frameOf(model: ModelId, b: number[]) {
  if (model !== "gfs") return b;
  return [
    Math.max(-180, b[0] - 14),
    Math.max(-70, b[1] - 10),
    Math.min(180, b[2] + 14),
    Math.min(72, b[3] + 8),
  ];
}

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const pad = (n: number) => String(n).padStart(2, "0");
const ymdh = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;

export async function exists(url: string) {
  try {
    const r = await fetch(`${url}.idx`, {
      method: "HEAD",
      headers: UA,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Is this cycle's last forecast hour out (on the main feed or the fallback)? */
async function complete(model: ModelId, id: string) {
  const m = MODELS[model];
  const last = m.hours[m.hours.length - 1];
  const [d, h] = [id.slice(0, 8), id.slice(8)];
  return (
    (await exists(m.url(d, h, last))) ||
    (!!m.alt && (await exists(m.alt(d, h, last))))
  );
}

/** The model's cycle ids within 36 hours before `from`, newest first. */
function candidates(model: ModelId, from: number) {
  const m = MODELS[model];
  const t = new Date(from);
  t.setUTCMinutes(0, 0, 0);
  const out: string[] = [];
  for (let back = 0; back < 36; back++) {
    const c = new Date(t.getTime() - back * 3600_000);
    if (m.cycles.includes(c.getUTCHours())) out.push(ymdh(c));
  }
  return out;
}

/** The newest cycle whose last forecast hour has been published ("YYYYMMDDHH"). */
export async function latestCycle(model: ModelId, from = Date.now()) {
  for (const id of candidates(model, from))
    if (await complete(model, id)) return id;
  return null;
}

/**
 * Newest few complete cycles, newest first (the run list). Cycles are checked four at a time
 * rather than one by one, so the list comes back in a couple of round trips to NOAA.
 */
export async function recentCycles(model: ModelId, n = 4) {
  const out: string[] = [];
  const list = candidates(model, Date.now());
  for (let k = 0; k < list.length && out.length < n; k += 4) {
    const batch = list.slice(k, k + 4);
    const ok = await Promise.all(batch.map((id) => complete(model, id)));
    batch.forEach((id, j) => ok[j] && out.length < n && out.push(id));
  }
  return out;
}

/** One GRIB record, found by its .idx line and fetched by byte range. */
export async function record(url: string, match: string, also?: string) {
  const r = await fetch(`${url}.idx`, {
    headers: UA,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`idx ${r.status}`);
  const lines = (await r.text()).split("\n").filter(Boolean);
  const hits = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.includes(match) && (!also || l.includes(also)));
  if (!hits.length) throw new Error(`no record ${match}`);
  // Where a field is published instantaneous and time-averaged, take the instantaneous.
  const hit = hits.find(({ l }) => /:(\d+ hour fcst|anl):/.test(l)) ?? hits[0];
  const a = Number(hit.l.split(":")[1]);
  const next = lines[hit.i + 1];
  const b = next ? Number(next.split(":")[1]) - 1 : "";
  const d = await fetch(url, {
    headers: { ...UA, Range: `bytes=${a}-${b}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!d.ok) throw new Error(`grib ${d.status}`);
  return decodeGrib2(new Uint8Array(await d.arrayBuffer()));
}

const K2F = (k: number) => ((k - 273.15) * 9) / 5 + 32;
const MS2KT = 1.943844;

/** Unit changes, by parameter key (VIP's `convert`); ensemble mean/PMM keys as their base.
 * Resolved once per field, so the per-point work is just the arithmetic. */
function converter(raw: string, max: number): ((v: number) => number) | null {
  const key = raw.replace(/^(m|pm|lp)_/, "");
  switch (key) {
    case "qpf":
      return (v) => v / 25.4;
    case "gust":
      return (v) => v * 2.236936;
    case "dpt2m":
    case "tmp2m":
      return K2F;
    case "pwat":
      return (v) => v / 25.4;
    case "absv500":
    case "absv850":
      return (v) => v * 1e5;
    case "vort02":
      return (v) => v * 1e3;
    case "mslp":
      return (v) => v / 100;
    case "hgt500":
      return (v) => v / 10;
    case "tmp850":
    case "tmp700":
    case "tmp500":
      return (v) => v - 273.15;
    case "shear01":
    case "shear06":
    case "stmmot":
    case "shearsfc500":
    case "wind850":
    case "wind500":
    case "wind250":
      return (v) => v * MS2KT;
    case "retop":
    case "lclhgt":
      return (v) => v / 304.8;
    case "cldbase":
    case "fzlvl":
      return (v) => v * 3.28084;
    case "prate":
      return (v) => v * 3600;
    case "vis":
      return (v) => v / 1609.344;
    case "smoke":
      return (v) => v * 1e9;
  }
  if (key.startsWith("p_") && max <= 1.01) return (v) => v * 100;
  return null;
}

/** Bolton (1980) equivalent potential temperature from T, Td (K) and pressure (Pa). */
function thetaE(t: number, td: number, p: number) {
  const hpa = p / 100;
  const e = 6.112 * Math.exp((17.67 * (td - 273.15)) / (td - 29.65));
  const r = (0.622 * e) / Math.max(hpa - e, 1e-3);
  const tl = 56 + 1 / (1 / (td - 56) + Math.log(t / td) / 800);
  const th =
    t * (1000 / Math.max(hpa - e, 1e-3)) ** 0.2854 * (t / tl) ** (0.28 * r);
  return th * Math.exp((3036 / tl - 1.78) * r * (1 + 0.448 * r));
}

/**
 * The last few fields read, by model, run, hour and parameter: a frame, its city values and a
 * zoomed-in render arrive together, and one download from NOAA serves them all. Runs never
 * change once published, so there is nothing to go stale.
 */
const recent = new Map<string, Promise<Field>>();

/** The field a parameter plots, converted to its display unit. */
export function fieldFor(
  model: ModelId,
  cycle: string,
  fh: number,
  p: Param,
): Promise<Field> {
  const k = `${model}|${cycle}|${fh}|${p.key}`;
  let f = recent.get(k);
  if (!f) {
    f = loadField(model, cycle, fh, p);
    recent.set(k, f);
    f.catch(() => recent.delete(k));
    while (recent.size > 6) recent.delete(recent.keys().next().value!);
  }
  return f;
}

async function loadField(
  model: ModelId,
  cycle: string,
  fh: number,
  p: Param,
): Promise<Field> {
  const m = MODELS[model];
  const at = [cycle.slice(0, 8), cycle.slice(8), fh, p.file] as const;
  const read = (url: string) =>
    Promise.all([
      record(url, p.match, p.also),
      ...(p.extra ?? []).map((x) => record(url, x)),
    ]);
  const recs = await read(m.url(...at)).catch((e) =>
    m.alt ? read(m.alt(...at)) : Promise.reject(e),
  );
  const [a] = recs;
  const n = a.values.length;
  const out = new Float32Array(n);
  const vals = recs.map((r) => r.values);
  for (let i = 0; i < n; i++) {
    const x = vals[0][i];
    out[i] =
      p.combine === "mag"
        ? Math.hypot(x, vals[1][i])
        : p.combine === "vecdiff"
          ? Math.hypot(vals[2][i] - x, vals[3][i] - vals[1][i])
          : p.combine === "thetae"
            ? thetaE(x, vals[1][i], vals[2][i])
            : p.combine === "lapse"
              ? (x - vals[1][i]) / ((vals[3][i] - vals[2][i]) / 1000)
              : x;
  }
  let max = -Infinity;
  for (const v of out) if (v > max) max = v;
  const to = converter(p.key, max);
  if (to) for (let i = 0; i < n; i++) out[i] = to(out[i]);
  return { grid: a.grid, values: out };
}

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** One color per contour level: the scale's stops spread across the field's levels (the
 * shading glides between them). Listed scales (radar) keep their colors in order. */
export function rampColors(p: Param, colors: Colors) {
  const stops = (SCALES[p.cmap] ?? SCALES.prob).map((c, i) =>
    pick(colors, `model:${p.cmap}:${i}`, c),
  );
  const n = p.levels.length;
  const listed = p.cmap === "refl";
  return Array.from({ length: n }, (_, b) => {
    const f = n > 1 ? b / (n - 1) : 0;
    if (listed) return stops[Math.round(f * (stops.length - 1))];
    const x = f * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(x));
    const [r1, g1, b1] = hex(stops[k]);
    const [r2, g2, b2] = hex(stops[k + 1]);
    const t = x - k;
    const m = (a: number, c: number) => Math.round(a + (c - a) * t);
    return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  });
}

/** VIP's clamped Catmull-Rom: smooth through the samples, never outside the pair it sits between. */
function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const v =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  return Math.min(Math.max(v, Math.min(p1, p2)), Math.max(p1, p2));
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const b of td) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
}
/**
 * A palette PNG (one byte per pixel) with transparency per palette entry. Each row takes the
 * filter (none, left or up) that leaves the smallest residue: the palette runs in order along
 * the ramp, so neighbouring pixels differ by small steps and deflate packs them tightly.
 * Deflate runs at its middle level: the top level took three quarters of a frame's time for
 * files about 6% smaller (measured 2026-11-02); the picture is the same either way.
 */
function png(w: number, h: number, idx: Uint8Array, pal: number[][]) {
  const raw = Buffer.alloc((w + 1) * h);
  const cand = [Buffer.alloc(w), Buffer.alloc(w), Buffer.alloc(w)];
  for (let y = 0; y < h; y++) {
    const row = idx.subarray(y * w, (y + 1) * w);
    const up = y > 0 ? idx.subarray((y - 1) * w, y * w) : null;
    let best = 0;
    let bestCost = Infinity;
    for (let f = 0; f < 3; f++) {
      const c = cand[f];
      let cost = 0;
      for (let x = 0; x < w; x++) {
        const prev =
          f === 1 ? (x > 0 ? row[x - 1] : 0) : f === 2 && up ? up[x] : 0;
        const v = (row[x] - prev) & 255;
        c[x] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = f;
      }
    }
    raw[y * (w + 1)] = best;
    cand[best].copy(raw, y * (w + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 3, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("PLTE", Buffer.from(pal.flatMap((c) => c.slice(0, 3)))),
    chunk("tRNS", Buffer.from(pal.map((c) => c[3]))),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/** A field's value at a point (bilinear between the four grid cells around it), or null. */
export function sampleAt(f: Field, lat: number, lon: number): number | null {
  const [gw, gh] = gridSize(f.grid);
  const [fi, fj] = locator(f.grid)(lat, lon);
  if (!(fi >= 0 && fj >= 0 && fi <= gw - 1 && fj <= gh - 1)) return null;
  const i = Math.min(gw - 2, Math.floor(fi));
  const j = Math.min(gh - 2, Math.floor(fj));
  const ti = fi - i;
  const tj = fj - j;
  const v = f.values;
  const a = v[j * gw + i];
  const b = v[j * gw + i + 1];
  const c = v[(j + 1) * gw + i];
  const d = v[(j + 1) * gw + i + 1];
  const val =
    a * (1 - ti) * (1 - tj) +
    b * ti * (1 - tj) +
    c * (1 - ti) * tj +
    d * ti * tj;
  return Number.isFinite(val) ? val : null;
}

/** Shades along the ramp, and fading steps for a partial field's open edge (255 in all). */
const SHADES = 224;
const FADES = 15;

/** Paint a field over a region as a transparent Web-Mercator PNG (`width` px across). */
export function paint(
  f: Field,
  p: Pick<Param, "levels" | "full" | "clearAbove">,
  /** One color per level (rampColors). */
  colors: string[],
  b: number[],
  width: number,
  /** Optional mask: pixels where this is false stay transparent. */
  keep?: (lat: number, lon: number) => boolean,
) {
  const [w, s, e, n] = b;
  const top = mercY(n);
  const bot = mercY(s);
  const W = width;
  const H = Math.round((W * (top - bot)) / (((e - w) * Math.PI) / 180));
  const [gw, gh] = gridSize(f.grid);
  const v = f.values;
  const at = (i: number, j: number) =>
    v[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
  const lv = p.levels;
  const last = lv.length - 1;
  const rgb = colors.map(hex);
  // The palette: 0 clear; 1..SHADES along the ramp; then the first color fading in, then
  // the last color fading out.
  const shade = (u: number) => {
    const x = u * last;
    const k = Math.min(Math.max(0, last - 1), Math.floor(x));
    const t = last > 0 ? x - k : 0;
    const a = rgb[k];
    const c = rgb[Math.min(last, k + 1)];
    return a.map((ch, q) => Math.round(ch + (c[q] - ch) * t));
  };
  const pal: number[][] = [[0, 0, 0, 0]];
  for (let i = 0; i < SHADES; i++) pal.push([...shade(i / (SHADES - 1)), 255]);
  for (let i = 1; i <= FADES; i++)
    pal.push([...rgb[0], Math.round((255 * i) / (FADES + 1))]);
  for (let i = 1; i <= FADES; i++)
    pal.push([...rgb[last], Math.round((255 * i) / (FADES + 1))]);
  // A partial field (radar, CAPE...) fades in over half its first step instead of a hard cut;
  // one cleared above (CIN, visibility) fades out over half its last step.
  // Never across zero: "no rain" or "no inhibition" stays clear.
  let edge = last > 0 ? (lv[1] - lv[0]) / 2 : 1;
  if (lv[0] > 0) edge = Math.min(edge, lv[0] / 2);
  let topEdge = last > 0 ? (lv[last] - lv[last - 1]) / 2 : 1;
  if (lv[last] < 0) topEdge = Math.min(topEdge, -lv[last] / 2);
  // Levels rise, so the step a value falls in is found by halving (the same step a walk
  // up the list stops at).
  const indexOf = (val: number) => {
    if (Number.isNaN(val)) return 0;
    if (val < lv[0]) {
      if (p.full) return 1;
      const a = (val - (lv[0] - edge)) / edge;
      return a <= 0
        ? 0
        : 1 + SHADES + Math.min(FADES - 1, Math.floor(a * FADES));
    }
    if (val >= lv[last]) {
      if (!p.clearAbove) return SHADES;
      const a = 1 - (val - lv[last]) / topEdge;
      return a <= 0
        ? 0
        : a >= 1
          ? SHADES
          : 1 + SHADES + FADES + Math.min(FADES - 1, Math.floor(a * FADES));
    }
    let lo = 0;
    let hi = Math.max(0, last - 1);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (val >= lv[mid]) lo = mid;
      else hi = mid - 1;
    }
    const k = lo;
    const u = (k + (val - lv[k]) / (lv[k + 1] - lv[k])) / Math.max(1, last);
    return 1 + Math.round(u * (SHADES - 1));
  };
  const idx = new Uint8Array(W * H);
  const lons = new Float64Array(W);
  for (let x = 0; x < W; x++) lons[x] = w + ((x + 0.5) / W) * (e - w);
  const locRow = rowLocator(f.grid, lons);
  const fiRow = new Float64Array(W);
  const fjRow = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    const lat = unMercY(top - ((y + 0.5) / H) * (top - bot));
    locRow(lat, fiRow, fjRow);
    for (let x = 0; x < W; x++) {
      if (keep && !keep(lat, lons[x])) continue;
      const fi = fiRow[x];
      const fj = fjRow[x];
      if (fi < 0 || fj < 0 || fi > gw - 1 || fj > gh - 1) continue;
      const i = Math.floor(fi);
      const j = Math.floor(fj);
      const ti = fi - i;
      const tj = fj - j;
      let val: number;
      if (i >= 1 && j >= 1 && i + 2 <= gw - 1 && j + 2 <= gh - 1) {
        // Inside the grid's edge: read the 4×4 neighbourhood straight from the array.
        const b = j * gw + i;
        const v00 = v[b];
        if (Number.isNaN(v00 + v[b + 1] + v[b + gw] + v[b + gw + 1])) {
          val = v[Math.round(fj) * gw + Math.round(fi)];
        } else {
          const a = b - gw;
          const c = b + gw;
          const d = c + gw;
          val = cr(
            cr(v[a - 1], v[a], v[a + 1], v[a + 2], ti),
            cr(v[b - 1], v00, v[b + 1], v[b + 2], ti),
            cr(v[c - 1], v[c], v[c + 1], v[c + 2], ti),
            cr(v[d - 1], v[d], v[d + 1], v[d + 2], ti),
            tj,
          );
          if (Number.isNaN(val)) val = v00;
        }
      } else if (
        Number.isNaN(at(i, j) + at(i + 1, j) + at(i, j + 1) + at(i + 1, j + 1))
      ) {
        val = at(Math.round(fi), Math.round(fj));
      } else {
        const row = (jj: number) =>
          cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), ti);
        val = cr(row(j - 1), row(j), row(j + 1), row(j + 2), tj);
        if (Number.isNaN(val)) val = at(i, j);
      }
      idx[y * W + x] = indexOf(val);
    }
  }
  return { png: png(W, H, idx, pal), w: W, h: H };
}

/**
 * The field's value at each city in MODEL_CITIES (same order), printed on the map like Max
 * Velocity's (owner, 2026-11-02). A value is left out where the map draws nothing (radar under
 * its first level, CIN near zero), so a city never shows a number the map doesn't.
 */
export function cityValues(
  f: Field,
  p: Pick<Param, "levels" | "full" | "clearAbove">,
) {
  const lv = p.levels;
  const lo = lv[0];
  const hi = lv[lv.length - 1];
  // Small ranges (inches of water, thousands of feet) read to a tenth; the rest whole.
  const tenth = hi - lo <= 10;
  return MODEL_CITIES.map(([, lat, lon]) => {
    const x = sampleAt(f, lat, lon);
    if (x === null) return null;
    if (!p.full && !p.clearAbove && x < lo) return null;
    if (p.clearAbove && x > hi) return null;
    return tenth ? Math.round(x * 10) / 10 : Math.round(x);
  });
}

export const paramOf = (model: ModelId, key: string) =>
  MODELS[model].params.find((p) => p.key === key);
