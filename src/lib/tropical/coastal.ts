import "server-only";
import { inflateRawSync } from "node:zlib";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { decodeGrib2 } from "@/lib/models/grib2";
import { getOutlook } from "./nhc";

/**
 * Coastal Impact (post-launch A7): when a hurricane threatens the U.S., the chance of more than
 * 3, 6 or 9 feet of storm surge above ground (NHC's P-Surge, the 625 m probabilistic surge
 * from many storm tracks) and when tropical-storm-force winds are likely to arrive (NHC's time
 * of arrival grids: earliest reasonable and most likely), both free files from NHC.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
export const FEET = [3, 6, 9] as const;
/** P-Surge cells are pooled into squares this many degrees wide (about 3 miles). */
const STEP = 0.04;

/** The first file inside a zip (a KMZ holds one KML). */
function unzipFirst(buf: Buffer) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip");
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const start =
    local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + size);
  return method === 8 ? inflateRawSync(data) : data;
}

/** [lat, lon, low %, high %] squares from one P-Surge KML (the highest bin in each square). */
function surgeCells(kml: string): [number, number, number, number][] {
  const best = new Map<string, [number, number, number, number]>();
  const re =
    /<name><!\[CDATA\[\[([\d.]+),([\d.]+)\)\]\]><\/name>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g;
  for (let m = re.exec(kml); m; m = re.exec(kml)) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const pt of m[3].trim().split(/\s+/)) {
      const [x, y] = pt.split(",");
      sx += Number(x);
      sy += Number(y);
      n++;
    }
    if (!n) continue;
    const lat = Math.round(sy / n / STEP) * STEP;
    const lon = Math.round(sx / n / STEP) * STEP;
    const k = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const was = best.get(k);
    if (!was || lo > was[2])
      best.set(k, [+lat.toFixed(2), +lon.toFixed(2), lo, Math.min(hi, 100)]);
  }
  return [...best.values()];
}

async function get(url: string, revalidate: number) {
  const r = await fetch(url, {
    headers: UA,
    next: { revalidate },
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  return r?.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

/** The newest P-Surge run (synoptic time, YYYYMMDDHH) for a storm, looking back two days. */
async function surgeRun(id: string) {
  const now = Date.now();
  for (let back = 0; back <= 48; back += 6) {
    const t = new Date(
      Math.floor(now / 21600_000) * 21600_000 - back * 3600_000,
    );
    const run = t.toISOString().slice(0, 13).replace(/[-T]/g, "");
    const r = await fetch(
      `https://www.nhc.noaa.gov/gis/storm_surge/${id}_psurge3_${run}.kmz`,
      { method: "HEAD", headers: UA, signal: AbortSignal.timeout(10000) },
    ).catch(() => null);
    if (r?.ok) return run;
  }
  return null;
}

async function surge(id: string, run: string) {
  const out: Record<number, [number, number, number, number][]> = {};
  await Promise.all(
    FEET.map(async (ft) => {
      const kmz = await get(
        `https://www.nhc.noaa.gov/gis/storm_surge/${id}_psurge${ft}_${run}.kmz`,
        3 * 3600,
      );
      out[ft] = kmz ? surgeCells(unzipFirst(kmz).toString("utf8")) : [];
    }),
  );
  return out;
}

/** The newest time-of-arrival file for a storm (34 kt winds), or a given advisory. */
async function toa(id: string, year: string, adv?: string) {
  const ID = id.toUpperCase();
  const dir = `https://ftp.nhc.ncep.noaa.gov/toa/${adv ? `${year}/` : ""}`;
  let name = adv ? `${ID}_TOA_TOD_34kt_adv${adv}.grib2` : null;
  if (!name) {
    const r = await fetch(dir, {
      headers: UA,
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    if (!r?.ok) return null;
    const list = [
      ...(await r.text()).matchAll(
        new RegExp(`${ID}_TOA_TOD_34kt_adv(\\d+)\\.grib2`, "g"),
      ),
    ].map((m) => m[0]);
    name = list.sort().at(-1) ?? null;
  }
  if (!name) return null;
  const buf = await get(dir + name, 6 * 3600);
  if (!buf) return null;
  // Four fields: earliest reasonable and most likely arrival, then departure (epoch seconds).
  const fields: ReturnType<typeof decodeGrib2>[] = [];
  for (let i = 0; i < buf.length && fields.length < 2;) {
    const j = buf.indexOf("GRIB", i);
    if (j < 0) break;
    const len = Number(buf.readBigUInt64BE(j + 8));
    fields.push(decodeGrib2(new Uint8Array(buf.subarray(j, j + len))));
    i = j + len;
  }
  if (fields.length < 2 || fields[0].grid.kind !== "latlon") return null;
  const g = fields[0].grid;
  const cells: [number, number, number, number][] = [];
  fields[0].values.forEach((v, k) => {
    if (!Number.isFinite(v)) return;
    const i = k % g.ni;
    const j = Math.floor(k / g.ni);
    const lat = g.southward ? g.lat1 - j * g.dj : g.lat1 + j * g.dj;
    const lon = ((((g.lon1 + i * g.di + 180) % 360) + 360) % 360) - 180;
    cells.push([lat, lon, v * 1000, fields[1].values[k] * 1000]);
  });
  return { file: name, step: g.di, cells };
}

export type Stretch = {
  lat: number;
  lon: number;
  place: string;
  /** Low end of the chance bin (%) of more than 3, 6 and 9 ft. */
  p: [number, number, number];
  /** Most likely arrival of tropical-storm winds (ms), when known. */
  arrive: number | null;
};

let rows: ReturnType<typeof parsePlaces> | null = null;
/** The coast in stretches of about 15 miles: each one's best chance per threshold, near a town. */
function stretches(st: Omit<CoastStorm, "stretches">): Stretch[] {
  const bins = new Map<string, Stretch>();
  const B = 0.25;
  FEET.forEach((ft, f) => {
    for (const [lat, lon, lo] of st.surge[ft] ?? []) {
      if (lo < 5) continue;
      const k = `${Math.round(lat / B)},${Math.round(lon / B)}`;
      const b = bins.get(k) ?? {
        lat,
        lon,
        place: "",
        p: [0, 0, 0],
        arrive: null,
      };
      if (lo > b.p[f]) b.p[f] = lo;
      if (f === 0 && lo >= b.p[0]) {
        b.lat = lat;
        b.lon = lon;
      }
      bins.set(k, b);
    }
  });
  rows ??= parsePlaces(PLACES);
  const list: Stretch[] = [];
  for (const b of [...bins.values()].sort(
    (a, c) => c.p[0] - a.p[0] || c.p[1] - a.p[1] || c.p[2] - a.p[2],
  )) {
    // Stretches at least ~20 miles apart, so the list covers the coast instead of one bay.
    if (list.some((x) => Math.hypot(x.lat - b.lat, x.lon - b.lon) < 0.3))
      continue;
    list.push(b);
    if (list.length >= 12) break;
  }
  for (const b of list) {
    const near = nearestPlace(rows, b.lat, b.lon, 1000);
    b.place = near
      ? `${near.miles < 4 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`
      : `${b.lat.toFixed(2)}, ${b.lon.toFixed(2)}`;
    const c = st.toa?.cells.reduce<[number, number, number, number] | null>(
      (best, x) =>
        Math.abs(x[0] - b.lat) <= 0.5 &&
        Math.abs(x[1] - b.lon) <= 0.5 &&
        (!best ||
          Math.hypot(x[0] - b.lat, x[1] - b.lon) <
            Math.hypot(best[0] - b.lat, best[1] - b.lon))
          ? x
          : best,
      null,
    );
    b.arrive = c ? c[3] : null;
  }
  return list;
}

export type CoastStorm = {
  id: string;
  name: string;
  stretches: Stretch[];
  /** P-Surge run (UTC synoptic time) and its squares per threshold: [lat, lon, low %, high %]. */
  run: string | null;
  surge: Record<number, [number, number, number, number][]>;
  /** Tropical-storm-force wind arrival: [lat, lon, earliest reasonable ms, most likely ms]. */
  toa: {
    file: string;
    step: number;
    cells: [number, number, number, number][];
  } | null;
};
export type Coastal = {
  at: string;
  example: boolean;
  storms: CoastStorm[];
};

/** Every active Atlantic or East Pacific storm NHC is running P-Surge or arrival times for. */
export async function coastalNow(): Promise<Coastal> {
  const o = await getOutlook();
  const near = o.storms.filter(
    (s) =>
      (s.basin === "AL" || s.basin === "EP") &&
      s.lat > 10 &&
      s.lon > -125 &&
      s.lon < -60,
  );
  const storms = (
    await Promise.all(
      near.map(async (s) => {
        const id = s.id.toLowerCase();
        const [run, arrival] = await Promise.all([
          surgeRun(id),
          toa(id, id.slice(-4)).catch(() => null),
        ]);
        const sg = run ? await surge(id, run) : {};
        const hasSurge = Object.values(sg).some((c) => c.length);
        if (!hasSurge && !arrival?.cells.length) return null;
        const st = {
          id,
          name: s.title,
          run: hasSurge ? run : null,
          surge: sg,
          toa: arrival,
        };
        return { ...st, stretches: stretches(st) };
      }),
    )
  ).filter((x): x is CoastStorm => !!x);
  return { at: new Date().toISOString(), example: false, storms };
}

/** A fixed example for when nothing threatens: Hurricane Helene, 26 Sept. 2024 00Z (advisory 10). */
export async function coastalExample(): Promise<Coastal> {
  const [sg, arrival] = await Promise.all([
    surge("al092024", "2024092600"),
    toa("al092024", "2024", "010"),
  ]);
  const st = {
    id: "al092024",
    name: "Hurricane Helene",
    run: "2024092600",
    surge: sg,
    toa: arrival,
  };
  return {
    at: "2024-09-26T03:00:00.000Z",
    example: true,
    storms: [{ ...st, stretches: stretches(st) }],
  };
}
