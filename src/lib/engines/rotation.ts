import "server-only";
import { createInflate, gunzipSync } from "node:zlib";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { stormCenters } from "./probsevere";

/**
 * Rotation Track Persistence (Extras): NOAA MRMS rotation tracks, the strongest 0–2 km
 * azimuthal shear each spot saw over the last 1, 2, 4, 6 or 24 hours. The national grid is
 * 7000 × 14000 cells, packed as a 16-bit PNG inside GRIB2; it is inflated as a stream, one
 * row at a time, keeping only cells with real rotation, so memory stays small.
 */
/** The windows MRMS publishes, in minutes. */
export const ROT_WINDOWS = [60, 120, 240, 360, 1440] as const;
export type RotWindow = (typeof ROT_WINDOWS)[number];
export const isRotWindow = (n: number): n is RotWindow =>
  (ROT_WINDOWS as readonly number[]).includes(n);
const url = (w: RotWindow) =>
  `https://mrms.ncep.noaa.gov/2D/RotationTrack${w}min/MRMS_RotationTrack${w}min.latest.grib2.gz`;
const meshUrl = (w: RotWindow) =>
  `https://mrms.ncep.noaa.gov/2D/MESH_Max_${w}min/MRMS_MESH_Max_${w}min.latest.grib2.gz`;
/** mm: MRMS's estimated hail size at or above this means a storm's updraft really was there. */
const MESH_MIN = 2;
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
/** ×10⁻³ s⁻¹: below this a track is noise. */
export const ROT_MIN = 4;
/** Cells are pooled to 0.02° (about 2 km). */
const POOL = 0.02;

const u32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const sm32 = (b: Uint8Array, o: number) => {
  const v = u32(b, o) & 0x7fffffff;
  return b[o] & 0x80 ? -v : v;
};
const sm16 = (b: Uint8Array, o: number) => {
  const v = ((b[o] & 0x7f) << 8) | b[o + 1];
  return b[o] & 0x80 ? -v : v;
};

type Grid = {
  ni: number;
  nj: number;
  lat1: number;
  lon1: number;
  di: number;
  dj: number;
};
type Pack = { r: number; e: number; d: number; bits: number };

/** The grid (template 3.0), packing (5.41) and PNG bytes of a one-field GRIB2 message. */
export function sections(buf: Uint8Array) {
  let o = 16;
  let grid: Grid | null = null;
  let pack: Pack | null = null;
  let png: Uint8Array | null = null;
  while (o < buf.length - 4) {
    if (buf[o] === 0x37 && buf[o + 1] === 0x37 && buf[o + 2] === 0x37) break;
    const len = u32(buf, o);
    const n = buf[o + 4];
    if (n === 3) {
      if (((buf[o + 12] << 8) | buf[o + 13]) !== 0)
        throw new Error("MRMS grid template");
      grid = {
        ni: u32(buf, o + 30),
        nj: u32(buf, o + 34),
        lat1: sm32(buf, o + 46) / 1e6,
        lon1: sm32(buf, o + 50) / 1e6,
        di: u32(buf, o + 63) / 1e6,
        dj: u32(buf, o + 67) / 1e6,
      };
    } else if (n === 5) {
      if (((buf[o + 9] << 8) | buf[o + 10]) !== 41)
        throw new Error("MRMS packing template");
      const view = new DataView(buf.buffer, buf.byteOffset + o + 11, 4);
      pack = {
        r: view.getFloat32(0),
        e: sm16(buf, o + 15),
        d: sm16(buf, o + 17),
        bits: buf[o + 19],
      };
    } else if (n === 7) png = buf.subarray(o + 5, o + len);
    o += len;
  }
  if (!grid || !pack || !png) throw new Error("MRMS message incomplete");
  return { grid, pack, png };
}

/** Streams the PNG's rows, calling `row(j, values)` with raw integers for each. */
async function eachRow(
  png: Uint8Array,
  row: (j: number, ints: Uint16Array | Uint8Array) => void,
) {
  const w = u32(png, 16);
  const depth = png[24];
  const bpp = depth === 16 ? 2 : 1;
  const stride = w * bpp;
  const idat: Uint8Array[] = [];
  for (let o = 8; o < png.length;) {
    const len = u32(png, o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    if (type === "IDAT") idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  let filter = -1;
  let fill = 0;
  let j = 0;
  const ints = bpp === 2 ? new Uint16Array(w) : new Uint8Array(w);
  const finish = () => {
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let x = cur[i];
      if (filter === 1) x += a;
      else if (filter === 2) x += b;
      else if (filter === 3) x += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        x += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = x & 255;
    }
    if (bpp === 2)
      for (let i = 0; i < w; i++) ints[i] = (cur[2 * i] << 8) | cur[2 * i + 1];
    else ints.set(cur);
    row(j++, ints);
    [prev, cur] = [cur, prev];
    filter = -1;
    fill = 0;
  };
  await new Promise<void>((resolve, reject) => {
    const z = createInflate();
    z.on("data", (chunk: Buffer) => {
      let k = 0;
      while (k < chunk.length) {
        if (filter < 0) {
          filter = chunk[k++];
          continue;
        }
        const take = Math.min(stride - fill, chunk.length - k);
        cur.set(chunk.subarray(k, k + take), fill);
        fill += take;
        k += take;
        if (fill === stride) finish();
      }
    });
    z.on("end", resolve);
    z.on("error", reject);
    for (const part of idat) z.write(part);
    z.end();
  });
}

export type RotCell = { lat: number; lon: number; v: number };
export type RotTrack = {
  place: string;
  lat: number;
  lon: number;
  peak: number;
  km: number;
  cells: number;
};

/** Pools hot cells to ~2 km and joins touching ones into tracks. */
export function tracks(cells: RotCell[]) {
  const key = (c: RotCell) =>
    `${Math.round(c.lat / POOL)}:${Math.round(c.lon / POOL)}`;
  const at = new Map(cells.map((c, i) => [key(c), i]));
  const parent = cells.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  cells.forEach((c, i) => {
    const y = Math.round(c.lat / POOL);
    const x = Math.round(c.lon / POOL);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const k = at.get(`${y + dy}:${x + dx}`);
        if (k !== undefined) parent[find(k)] = find(i);
      }
  });
  const groups = new Map<number, RotCell[]>();
  cells.forEach((c, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  });
  return [...groups.values()];
}

/** km: a rotating storm leaves a trail about this wide at most; wider is a blob of clutter
 * or of many storms run together. */
const TRAIL_KM = 12;

const cellKey = (lat: number, lon: number) =>
  `${Math.round(lat / POOL)}:${Math.round(lon / POOL)}`;

/** Fetches a one-field MRMS GRIB2 and calls `hit` for every CONUS cell at or above `min`. */
export async function scan(
  src: string,
  min: number,
  hit: (lat: number, lon: number, v: number) => void,
) {
  const r = await fetch(src, {
    headers: UA,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`MRMS ${r.status}`);
  const buf = new Uint8Array(gunzipSync(new Uint8Array(await r.arrayBuffer())));
  const { grid, pack, png } = sections(buf);
  const scale = 2 ** pack.e;
  const div = 10 ** pack.d;
  const floor = Math.max(1, Math.ceil((min * div - pack.r) / scale));
  await eachRow(png, (j, ints) => {
    for (let i = 0; i < ints.length; i++) {
      if (ints[i] < floor) continue;
      const lat = grid.lat1 - j * grid.dj;
      const lon = ((grid.lon1 + i * grid.di + 180) % 360) - 180;
      // The lower 48 only; the grid runs into Canada and Mexico.
      if (lat > 49.5 || lat < 24 || lon < -125 || lon > -66.5) continue;
      hit(lat, lon, (pack.r + ints[i] * scale) / div);
    }
  });
  return r.headers.get("last-modified");
}

/** The ~2 km cells where MRMS estimated hail over the window: where a storm's updraft was. */
async function hailSwath(src: string) {
  const keys = new Set<string>();
  await scan(src, MESH_MIN, (lat, lon) => keys.add(cellKey(lat, lon)));
  return keys;
}

let rows: ReturnType<typeof parsePlaces> | null = null;

/** `archive` reads past MRMS files instead of the latest (the color editor's example). */
export async function rotationTracks(
  win: RotWindow = 60,
  archive?: { rot: string; mesh: string },
) {
  // Over two hours or less, the storms that left the tracks are still on ProbSevere's list.
  // Longer windows include storms that have since died, so there a track must instead run
  // through MRMS's hail swath for the same window: a storm's updraft really was there.
  const recent = win <= 120;
  const pool = new Map<string, RotCell>();
  const [stamp, storms, hail] = await Promise.all([
    // MRMS stores rotation tracks in units of 0.001 s⁻¹, the unit ROT_MIN is in.
    scan(archive?.rot ?? url(win), ROT_MIN, (lat, lon, v) => {
      const k = cellKey(lat, lon);
      const had = pool.get(k);
      if (!had || had.v < v)
        pool.set(k, {
          lat: Math.round(lat / POOL) * POOL,
          lon: Math.round(lon / POOL) * POOL,
          v,
        });
    }),
    recent ? stormCenters().catch(() => null) : null,
    recent ? null : hailSwath(archive?.mesh ?? meshUrl(win)).catch(() => null),
  ]);
  // Rotation only counts inside a real storm: within 50 km of one ProbSevere is tracking.
  // That drops sea clutter, wind farms and other radar noise.
  const nearStorm = (g: RotCell[]) =>
    !storms ||
    g.some((c) =>
      storms.some(
        ([lat, lon]) =>
          Math.abs(lat - c.lat) < 0.5 &&
          Math.hypot(
            (lat - c.lat) * 111.32,
            (lon - c.lon) * 111.32 * Math.cos((c.lat * Math.PI) / 180),
          ) < 50,
      ),
    );
  // …or, over long windows, has at least a few cells within ~4 km of hail.
  const inHail = (g: RotCell[]) => {
    if (!hail) return true;
    let n = 0;
    for (const c of g) {
      const y = Math.round(c.lat / POOL);
      const x = Math.round(c.lon / POOL);
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++)
        for (let dx = -2; dx <= 2 && !near; dx++)
          near = hail.has(`${y + dy}:${x + dx}`);
      if (near && ++n >= Math.min(5, Math.max(3, g.length * 0.15))) return true;
    }
    return false;
  };
  const cells = [...pool.values()].map((c) => ({
    lat: Math.round(c.lat * 1000) / 1000,
    lon: Math.round(c.lon * 1000) / 1000,
    v: Math.round(c.v * 10) / 10,
  }));
  rows ??= parsePlaces(PLACES);
  const places = rows;
  const real = tracks(cells).filter((g) => nearStorm(g) && inHail(g));
  const list: RotTrack[] = real
    .filter((g) => g.length >= 5)
    .map((g) => {
      const top = g.reduce((a, b) => (b.v > a.v ? b : a));
      let km = 0;
      for (const a of [g[0], top])
        for (const b of g) {
          const d =
            Math.hypot(
              (b.lat - a.lat) * 111.32,
              (b.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180),
            ) || 0;
          if (d > km) km = d;
        }
      const near = nearestPlace(places, top.lat, top.lon, 1000);
      return {
        far: !near || near.miles > 75,
        // The group's area over its length is how wide the trail is.
        wide:
          (g.length *
            (POOL * 111.32) ** 2 *
            Math.cos((top.lat * Math.PI) / 180)) /
          Math.max(km, 1),
        place: near
          ? `${near.miles < 3 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`
          : `${top.lat.toFixed(2)}, ${top.lon.toFixed(2)}`,
        lat: top.lat,
        lon: top.lon,
        peak: top.v,
        km: Math.round(km),
        cells: g.length,
      };
    })
    // A track is something that moved: a blob that stays put is clutter.
    // …and one far from any U.S. town is over Canada, Mexico or open water.
    .filter(
      (t) =>
        t.km >= (recent ? 10 : 15) &&
        t.peak >= 6 &&
        !t.far &&
        (recent || t.wide <= TRAIL_KM),
    )
    .map((t) => ({
      place: t.place,
      lat: t.lat,
      lon: t.lon,
      peak: t.peak,
      km: t.km,
      cells: t.cells,
    }))
    .sort((a, b) => b.km * b.peak - a.km * a.peak)
    .slice(0, 25);
  // Over long windows only the tracks themselves are drawn, not every stray mark.
  const keep = new Set(list.map((t) => `${t.lat}:${t.lon}`));
  const drawn = recent
    ? real
    : real.filter((g) => g.some((c) => keep.has(`${c.lat}:${c.lon}`)));
  return {
    at: stamp ? new Date(stamp).toISOString() : new Date().toISOString(),
    window: win,
    cells: drawn.flat(),
    tracks: list,
  };
}
