import {
  decodeGrib2,
  gridSize,
  locator,
  rowLocator,
  type Field,
} from "./grib2";
import type { Param } from "./params";
import { MODEL_CITIES } from "./cities";

/**
 * Reading and drawing a model field, shared by the server (REFS, whose NOMADS feed a browser
 * can't read) and the viewer's worker (HRRR and GFS, read straight from NOAA's open data on
 * AWS, so drawing them costs our server nothing; owner, 2026-11-02, after Vercel paused the
 * project for going over its free usage). Nothing here touches Node or the DOM.
 *
 * The look (owner, 2026-11-02, after Max Velocity's HRRR pages): continuous shading, the color
 * gliding between the field's levels instead of filling flat bands, so every gradient and the
 * terrain's fingerprints show at the model's full 3 km detail. The field is sampled with a
 * clamped Catmull-Rom (smooth through the grid, never past a real value), which is what turns
 * GFS's 25 km cells from a mosaic into a smooth map. Frames are palette PNGs: 240 shades along
 * the field's ramp, about a fifth the size of full color.
 */

export { fill } from "./tpl";

/** How a reader fetches: the server adds its user agent and caching, a browser fetches plainly. */
export type Get = (url: string, init?: RequestInit) => Promise<Response>;

/** One GRIB record, found by its .idx line and fetched by byte range. */
export async function readRecord(
  get: Get,
  url: string,
  match: string,
  also?: string | (string | undefined)[],
) {
  const need = [also ?? []].flat().filter(Boolean) as string[];
  const r = await get(`${url}.idx`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`idx ${r.status}`);
  const lines = (await r.text()).split("\n").filter(Boolean);
  const hits = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.includes(match) && need.every((x) => l.includes(x)));
  if (!hits.length) throw new Error(`no record ${match}`);
  // Where a field is published instantaneous and time-averaged, take the instantaneous.
  const hit = hits.find(({ l }) => /:(\d+ hour fcst|anl):/.test(l)) ?? hits[0];
  const a = Number(hit.l.split(":")[1]);
  const next = lines[hit.i + 1];
  const b = next ? Number(next.split(":")[1]) - 1 : "";
  const d = await get(url, {
    headers: { Range: `bytes=${a}-${b}` },
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
    case "tropo":
      return (v) => v / 304.8;
    case "apcp":
    case "frzr":
      return (v) => v / 25.4;
    case "asnow":
    case "snod":
      return (v) => v * 39.3701;
    case "maxwind10":
    case "wind10":
      return (v) => v * 2.236936;
    case "lmmot":
      return (v) => v * MS2KT;
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

const C = (k: number) => k - 273.15;
/** Dew point (K) from temperature (K) and relative humidity (%), Magnus. */
function dewFromRh(t: number, rh: number) {
  const tc = C(t);
  const g = Math.log(Math.max(rh, 1) / 100) + (17.625 * tc) / (243.04 + tc);
  return (243.04 * g) / (17.625 - g) + 273.15;
}
/** Meteorological direction (degrees the wind blows from). */
const dirOf = (u: number, v: number) =>
  ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
/** SWEAT (Miller 1972): T, Td in K; winds in m/s. */
function sweat(
  t8: number,
  td8: number,
  t5: number,
  u8: number,
  v8: number,
  u5: number,
  v5: number,
) {
  const d = Math.max(0, C(td8));
  const tt = C(t8) + C(td8) - 2 * C(t5);
  const f8 = Math.hypot(u8, v8) * MS2KT;
  const f5 = Math.hypot(u5, v5) * MS2KT;
  const d8 = dirOf(u8, v8);
  const d5 = dirOf(u5, v5);
  const veer =
    d8 >= 130 &&
    d8 <= 250 &&
    d5 >= 210 &&
    d5 <= 310 &&
    d5 > d8 &&
    f8 >= 15 &&
    f5 >= 15
      ? 125 * (Math.sin(((d5 - d8) * Math.PI) / 180) + 0.2)
      : 0;
  return 12 * d + 20 * Math.max(0, tt - 49) + 2 * f8 + f5 + veer;
}
/** SPC's STP terms: the LCL (m AGL), 0-6 km bulk shear (m/s) and mixed-layer CIN (J/kg). */
const lclTerm = (z: number) =>
  z < 1000 ? 1 : z > 2000 ? 0 : (2000 - z) / 1000;
const shearTerm = (b: number) => (b < 12.5 ? 0 : b > 30 ? 1.5 : b / 20);
const cinTerm = (c: number) => (c > -50 ? 1 : c < -200 ? 0 : (200 + c) / 150);
const stp = (cape: number, lcl: number, srh: number, u: number, v: number) =>
  Math.max(
    0,
    (cape / 1500) * lclTerm(lcl) * (srh / 150) * shearTerm(Math.hypot(u, v)),
  );
/** Bunkers left mover from the right mover and the 0-6 km shear: 2 × 7.5 m/s across the shear. */
function leftMover(ru: number, rv: number, su: number, sv: number) {
  const s = Math.hypot(su, sv) || 1;
  return Math.hypot(ru - (15 * sv) / s, rv + (15 * su) / s);
}
/** NWS wind chill (°F) from 2 m temperature (K) and 10 m wind (m/s); the temperature itself
 * where wind chill isn't defined (above 50 °F or under 3 mph). */
function windChill(t: number, u: number, v: number) {
  const f = K2F(t);
  const mph = Math.hypot(u, v) * 2.236936;
  if (f > 50 || mph < 3) return f;
  const w = mph ** 0.16;
  return 35.74 + 0.6215 * f - 35.75 * w + 0.4275 * f * w;
}
/** SPC's Significant Hail Parameter, from most-unstable CAPE, the low-level mixing ratio, the
 * 700-500 mb lapse rate, 500 mb temperature and surface-500 mb shear (its freezing-level
 * adjustment is left out: GFS publishes that level apart). */
function ship(r: Float32Array[], i: number) {
  const cape = r[0][i];
  const mr = Math.min(13.6, Math.max(11, r[1][i] * 1000));
  const lr = (r[2][i] - r[3][i]) / ((r[5][i] - r[4][i]) / 1000);
  const t5 = Math.min(-5.5, C(r[3][i]));
  const shr = Math.min(
    27,
    Math.max(7, Math.hypot(r[8][i] - r[6][i], r[9][i] - r[7][i])),
  );
  let v = (cape * mr * lr * -t5 * shr) / 42_000_000;
  if (cape < 1300) v *= cape / 1300;
  if (lr < 5.8) v *= lr / 5.8;
  return Math.max(0, v);
}
/** How each combined field is built from its records, point by point. */
export const COMBINE: Record<string, (r: Float32Array[], i: number) => number> =
  {
    mag: (r, i) => Math.hypot(r[0][i], r[1][i]),
    vecdiff: (r, i) => Math.hypot(r[2][i] - r[0][i], r[3][i] - r[1][i]),
    thetae: (r, i) => thetaE(r[0][i], r[1][i], r[2][i]),
    lapse: (r, i) => (r[0][i] - r[1][i]) / ((r[3][i] - r[2][i]) / 1000),
    sweat: (r, i) =>
      sweat(r[0][i], r[1][i], r[2][i], r[3][i], r[4][i], r[5][i], r[6][i]),
    sweatrh: (r, i) =>
      sweat(
        r[0][i],
        dewFromRh(r[0][i], r[1][i]),
        r[2][i],
        r[3][i],
        r[4][i],
        r[5][i],
        r[6][i],
      ),
    ehi: (r, i) => (r[0][i] * r[1][i]) / 160_000,
    stp: (r, i) => stp(r[0][i], r[1][i], r[2][i], r[3][i], r[4][i]),
    stpe: (r, i) => stp(r[0][i], r[1][i], r[2][i], r[3][i], r[4][i]),
    stpc: (r, i) =>
      stp(r[0][i], r[1][i], r[2][i], r[3][i], r[4][i]) * cinTerm(r[5][i]),
    lm: (r, i) => leftMover(r[0][i], r[1][i], r[2][i], r[3][i]),
    lmgfs: (r, i) =>
      leftMover(r[0][i], r[1][i], r[4][i] - r[2][i], r[5][i] - r[3][i]),
    wchill: (r, i) => windChill(r[0][i], r[1][i], r[2][i]),
    thetae850: (r, i) => thetaE(r[0][i], dewFromRh(r[0][i], r[1][i]), 85_000),
    snow6: (r, i) => (r[0][i] / 25.4) * 10 * Math.min(1, Math.max(0, r[1][i])),
    ship,
  };

/** What reading and drawing a parameter needs (sent to the browser with the run list). */
export type Recipe = Pick<
  Param,
  | "key"
  | "match"
  | "also"
  | "extra"
  | "combine"
  | "levels"
  | "full"
  | "clearAbove"
  | "coarse"
  | "win"
>;

/**
 * The field a parameter plots, converted to its display unit, from the first of `urls` that
 * has it (REFS: the parallel feed when production has nothing yet).
 */
export async function loadFieldFrom(
  get: Get,
  urls: string[],
  p: Recipe,
  /** The forecast hour, for fields with an accumulation window. */
  fh?: number,
): Promise<Field> {
  const win = p.win && fh != null ? `:${fh - p.win}-${fh} hour acc` : undefined;
  const read = (url: string) =>
    Promise.all([
      readRecord(get, url, p.match, [p.also, win]),
      ...(p.extra ?? []).map((x) => readRecord(get, url, x)),
    ]);
  let recs: Awaited<ReturnType<typeof read>> | null = null;
  let err: unknown = null;
  for (const url of urls) {
    try {
      recs = await read(url);
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!recs) throw err;
  const [a] = recs;
  const n = a.values.length;
  const out = new Float32Array(n);
  const vals = recs.map((r) => r.values as Float32Array);
  const f = p.combine ? COMBINE[p.combine] : null;
  for (let i = 0; i < n; i++) out[i] = f ? f(vals, i) : vals[0][i];
  let max = -Infinity;
  for (const v of out) if (v > max) max = v;
  const to = converter(p.key, max);
  if (to) for (let i = 0; i < n; i++) out[i] = to(out[i]);
  return { grid: a.grid, values: out };
}

export const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

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
const be32 = (v: number) =>
  Uint8Array.of(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const join = (list: Uint8Array[]) => {
  const out = new Uint8Array(list.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of list) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};
function chunk(type: string, data: Uint8Array) {
  const td = join([Uint8Array.from(type, (ch) => ch.charCodeAt(0)), data]);
  let c = 0xffffffff;
  for (const b of td) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return join([be32(data.length), td, be32((c ^ 0xffffffff) >>> 0)]);
}

/**
 * A palette PNG's rows, filtered (one byte per pixel, each row led by its filter). Each row
 * takes the filter (none, left or up) that leaves the smallest residue: the palette runs in
 * order along the ramp, so neighbouring pixels differ by small steps and deflate packs them
 * tightly. The caller deflates it (the server with zlib at its middle level: the top level took
 * three quarters of a frame's time for files about 6% smaller, measured 2026-11-02; a browser
 * with its own deflate) and hands the result to `pngFile`.
 */
export function pngRows(w: number, h: number, idx: Uint8Array) {
  const raw = new Uint8Array((w + 1) * h);
  const cand = [new Uint8Array(w), new Uint8Array(w), new Uint8Array(w)];
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
    raw.set(cand[best], y * (w + 1) + 1);
  }
  return raw;
}

/** The PNG file around deflated rows, with transparency per palette entry. */
export function pngFile(
  w: number,
  h: number,
  pal: number[][],
  deflated: Uint8Array,
) {
  const ihdr = join([be32(w), be32(h), Uint8Array.of(8, 3, 0, 0, 0)]);
  return join([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", ihdr),
    chunk("PLTE", Uint8Array.from(pal.flatMap((c) => c.slice(0, 3)))),
    chunk("tRNS", Uint8Array.from(pal.map((c) => c[3]))),
    chunk("IDAT", deflated),
    chunk("IEND", new Uint8Array(0)),
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

/**
 * Paint a field over a region in Web Mercator (`width` px across): one palette index per pixel
 * and the palette (index 0 clear). `pngRows`/`pngFile` turn it into a PNG.
 */
export function paintIndex(
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
  const round =
    f.grid.kind === "latlon" && Math.abs(gw * f.grid.di - 360) < 1e-3;
  const fiRow = new Float64Array(W);
  const fjRow = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    const lat = unMercY(top - ((y + 0.5) / H) * (top - bot));
    locRow(lat, fiRow, fjRow);
    for (let x = 0; x < W; x++) {
      if (keep && !keep(lat, lons[x])) continue;
      // A grid that circles the globe (GFS) has no gap between its last column and the
      // first: the sliver past the last column takes its edge instead of staying clear.
      const fi = round && fiRow[x] > gw - 1 ? gw - 1 : fiRow[x];
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
  return { idx, pal, w: W, h: H };
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
