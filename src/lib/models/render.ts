import "server-only";
import { deflateSync } from "node:zlib";
import { pick, type Colors } from "@/lib/colors/pick";
import { decodeGrib2, gridSize, locator, type Field } from "./grib2";
import { GFS, HRRR, REFS, SCALES, type Param } from "./params";

/**
 * Model maps rendered on demand from NOAA's own GRIB2 files: the viewer asks for one
 * field at one forecast hour, we read the file's .idx, fetch just that record with an
 * HTTP Range request (a few hundred KB of a 100+ MB file), decode it, and paint it into a
 * transparent Web-Mercator PNG for the map. Frames are immutable per run, so the CDN
 * keeps each one after the first request.
 *
 * The look is VIP's: discrete color bands on the model's contour levels, and the field
 * sampled with a clamped Catmull-Rom (smooth through the grid, never past a real value),
 * which is what turns GFS's 25 km cells from a mosaic into a smooth map.
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

/** The newest cycle whose last forecast hour has been published ("YYYYMMDDHH"). */
export async function latestCycle(model: ModelId, from = Date.now()) {
  const m = MODELS[model];
  const last = m.hours[m.hours.length - 1];
  const t = new Date(from);
  t.setUTCMinutes(0, 0, 0);
  for (let back = 0; back < 36; back++) {
    const c = new Date(t.getTime() - back * 3600_000);
    if (!m.cycles.includes(c.getUTCHours())) continue;
    const id = ymdh(c);
    const [d, h] = [id.slice(0, 8), id.slice(8)];
    if (
      (await exists(m.url(d, h, last))) ||
      (m.alt && (await exists(m.alt(d, h, last))))
    )
      return id;
  }
  return null;
}

/** Newest few cycles with their last hour published, newest first (the archive list). */
export async function recentCycles(model: ModelId, n = 4) {
  const out: string[] = [];
  let from = Date.now();
  while (out.length < n) {
    const c = await latestCycle(model, from);
    if (!c) break;
    out.push(c);
    from =
      Date.UTC(
        +c.slice(0, 4),
        +c.slice(4, 6) - 1,
        +c.slice(6, 8),
        +c.slice(8),
      ) - 3600_000;
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

/** Unit changes, by parameter key (VIP's `convert`); ensemble mean/PMM keys as their base. */
function convert(raw: string, v: number, max: number) {
  const key = raw.replace(/^(m|pm|lp)_/, "");
  switch (key) {
    case "qpf":
      return v / 25.4;
    case "gust":
      return v * 2.236936;
    case "dpt2m":
    case "tmp2m":
      return K2F(v);
    case "pwat":
      return v / 25.4;
    case "absv500":
    case "absv850":
      return v * 1e5;
    case "vort02":
      return v * 1e3;
    case "mslp":
      return v / 100;
    case "hgt500":
      return v / 10;
    case "tmp850":
    case "tmp700":
    case "tmp500":
      return v - 273.15;
    case "shear01":
    case "shear06":
    case "stmmot":
    case "shearsfc500":
    case "wind850":
    case "wind500":
    case "wind250":
      return v * MS2KT;
    case "retop":
    case "lclhgt":
      return v / 304.8;
    case "cldbase":
    case "fzlvl":
      return v * 3.28084;
    case "prate":
      return v * 3600;
    case "vis":
      return v / 1609.344;
    case "smoke":
      return v * 1e9;
  }
  if (key.startsWith("p_")) return max <= 1.01 ? v * 100 : v;
  return v;
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

/** The field a parameter plots, converted to its display unit. */
export async function fieldFor(
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
  for (let i = 0; i < n; i++) out[i] = convert(p.key, out[i], max);
  // 3 km fields carry grid-scale speckle; one light pass keeps every feature a forecaster
  // reads and drops the single-pixel noise (Fix list 2026-10-30 #8). Storm-scale fields
  // (radar, updrafts, lightning, ensemble chances) keep their full detail.
  if (model !== "gfs" && !SHARP.test(p.key)) {
    const [gw, gh] = gridSize(a.grid);
    return { grid: a.grid, values: despeckle(out, gw, gh) };
  }
  return { grid: a.grid, values: out };
}

/** Fields drawn at full detail: radar, tops, updraft helicity and speed, lightning, chances. */
const SHARP =
  /^(p_|pm_|lp_)|refc|refd|refl|retop|uphl|uh|ltng|lightning|uvv|prate|smoke|vis|cldbase|ptype/;

/** One 1-2-1 binomial pass in each direction over a grid, skipping missing cells. */
function despeckle(v: Float32Array, w: number, h: number) {
  const tmp = new Float32Array(v.length);
  const out = new Float32Array(v.length);
  const pass = (
    src: Float32Array,
    dst: Float32Array,
    dx: number,
    dy: number,
  ) => {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const c = src[k];
        if (Number.isNaN(c)) {
          dst[k] = c;
          continue;
        }
        const a =
          i - dx >= 0 && j - dy >= 0 ? src[k - dy * w - dx] : Number.NaN;
        const b = i + dx < w && j + dy < h ? src[k + dy * w + dx] : Number.NaN;
        const sa = Number.isNaN(a) ? c : a;
        const sb = Number.isNaN(b) ? c : b;
        dst[k] = (sa + 2 * c + sb) / 4;
      }
  };
  pass(v, tmp, 1, 0);
  pass(tmp, out, 0, 1);
  return out;
}

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** One color per band: a scale's stops spread across the bands (listed scales by index). */
export function bandColors(p: Param, colors: Colors) {
  const stops = (SCALES[p.cmap] ?? SCALES.prob).map((c, i) =>
    pick(colors, `model:${p.cmap}:${i}`, c),
  );
  const bands = p.levels.length + (p.full ? 1 : 0);
  const listed = p.cmap === "refl";
  return Array.from({ length: bands }, (_, b) => {
    const f = bands > 1 ? b / (bands - 1) : 0;
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
function png(w: number, h: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(
      raw,
      y * (w * 4 + 1) + 1,
    );
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unMercY = (y: number) => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/** Paint a field over a region as a transparent Web-Mercator PNG (`width` px across). */
export function paint(
  f: Field,
  p: Pick<Param, "levels" | "full">,
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
  const rgba = new Uint8Array(W * H * 4);
  const loc = locator(f.grid);
  const [gw, gh] = gridSize(f.grid);
  const v = f.values;
  const at = (i: number, j: number) =>
    v[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
  const rgb = colors.map(hex);
  const lv = p.levels;
  // Pass 1: the field at every pixel (NaN where there is none).
  const vals = new Float32Array(W * H).fill(Number.NaN);
  for (let y = 0; y < H; y++) {
    const lat = unMercY(top - ((y + 0.5) / H) * (top - bot));
    for (let x = 0; x < W; x++) {
      const lon = w + ((x + 0.5) / W) * (e - w);
      if (keep && !keep(lat, lon)) continue;
      const [fi, fj] = loc(lat, lon);
      if (fi < 0 || fj < 0 || fi > gw - 1 || fj > gh - 1) continue;
      const i = Math.floor(fi);
      const j = Math.floor(fj);
      const ti = fi - i;
      const tj = fj - j;
      const c11 = at(i, j);
      const c21 = at(i + 1, j);
      const c12 = at(i, j + 1);
      const c22 = at(i + 1, j + 1);
      let val: number;
      if (Number.isNaN(c11 + c21 + c12 + c22)) {
        val = at(Math.round(fi), Math.round(fj));
      } else {
        const row = (jj: number) =>
          cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), ti);
        val = cr(row(j - 1), row(j), row(j + 1), row(j + 2), tj);
        if (Number.isNaN(val)) val = c11;
      }
      vals[y * W + x] = val;
    }
  }
  // Band of a value: -1 = nothing drawn (under the first level of a partial field).
  const bandOf = (val: number) => {
    if (val < lv[0]) return p.full ? 0 : -1;
    let k = lv.length - 1;
    while (k > 0 && val < lv[k]) k--;
    return k + (p.full ? 1 : 0);
  };
  // Pass 2 (Fix list 2026-10-30 #8): each band edge is anti-aliased across a pixel (the
  // pixel's distance to the contour, from the local gradient, blends the two bands) and
  // traced with a thin dark line, so edges stay crisp and defined instead of stair-stepped.
  const LINE = 0.75;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const val = vals[o];
      if (Number.isNaN(val)) continue;
      const band = bandOf(val);
      const l = x > 0 ? vals[o - 1] : val;
      const r = x < W - 1 ? vals[o + 1] : val;
      const u = y > 0 ? vals[o - W] : val;
      const d = y < H - 1 ? vals[o + W] : val;
      const gx = (Number.isNaN(r) ? val : r) - (Number.isNaN(l) ? val : l);
      const gy = (Number.isNaN(d) ? val : d) - (Number.isNaN(u) ? val : u);
      const g = Math.hypot(gx, gy) / 2;
      // The nearest contour: the level at this band's floor or ceiling.
      const k = band - (p.full ? 1 : 0);
      const floor = k >= 0 ? lv[k] : -Infinity;
      const ceil = k + 1 < lv.length ? lv[k + 1] : Infinity;
      const below = val - floor;
      const above = ceil - val;
      const dist = g > 0 ? Math.min(below, above) / g : Infinity;
      let c = band >= 0 ? rgb[band] : null;
      let alpha = band >= 0 ? 255 : 0;
      if (dist < 0.5) {
        const other = bandOf(below < above ? floor - 1e-6 : ceil);
        const t = 0.5 - dist;
        const oc = other >= 0 ? rgb[other] : null;
        if (c && oc) c = c.map((ch, q) => Math.round(ch + (oc[q] - ch) * t));
        else if (c) alpha = Math.round(255 * (1 - t));
        else if (oc) {
          c = oc;
          alpha = Math.round(255 * t);
        }
      }
      if (!c || alpha === 0) continue;
      if (dist < LINE) {
        const dark = 0.38 * (1 - dist / LINE);
        c = c.map((ch) => Math.round(ch * (1 - dark)));
      }
      rgba[o * 4] = c[0];
      rgba[o * 4 + 1] = c[1];
      rgba[o * 4 + 2] = c[2];
      rgba[o * 4 + 3] = alpha;
    }
  return { png: png(W, H, rgba), w: W, h: H };
}

export const paramOf = (model: ModelId, key: string) =>
  MODELS[model].params.find((p) => p.key === key);
