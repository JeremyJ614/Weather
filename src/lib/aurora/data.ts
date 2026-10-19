import "server-only";
import { continuousEdge } from "./style";

/**
 * Aurora Center data, all NOAA SWPC: the OVATION 30-minute aurora forecast (the North
 * American sector, 1° grid), planetary Kp now and its 3-day forecast, and real-time solar
 * wind from whichever L1 spacecraft SWPC marks active.
 */
const SWPC = "https://services.swpc.noaa.gov";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const get = async <T>(path: string, revalidate: number | false): Promise<T> => {
  const r = await fetch(`${SWPC}${path}`, {
    headers: UA,
    ...(revalidate === false
      ? { cache: "no-store" as const }
      : { next: { revalidate } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`SWPC ${path} ${r.status}`);
  return (await r.json()) as T;
};

/** The North American sector: 30–85°N, 170°W–50°W. */
export const SECTOR = { lat0: 30, lat1: 85, lon0: -170, lon1: -50 };
/** Degrees equatorward of the 10% edge at which an aurora 100–250 km up clears the northern horizon. */
export const HORIZON_DEG = 6;

export async function ovation() {
  const j = await get<{
    "Observation Time": string;
    "Forecast Time": string;
    coordinates: [number, number, number][];
  }>("/json/ovation_aurora_latest.json", 300);
  const w = SECTOR.lon1 - SECTOR.lon0 + 1;
  const h = SECTOR.lat1 - SECTOR.lat0 + 1;
  const grid = new Array<number>(w * h).fill(0);
  for (const [lon360, lat, v] of j.coordinates) {
    const lon = lon360 > 180 ? lon360 - 360 : lon360;
    if (
      lat < SECTOR.lat0 ||
      lat > SECTOR.lat1 ||
      lon < SECTOR.lon0 ||
      lon > SECTOR.lon1
    )
      continue;
    grid[(lat - SECTOR.lat0) * w + (lon - SECTOR.lon0)] = v;
  }
  // The equatorward edge (first 10% from the south) and the view line below it.
  const edge: [number, number][] = [];
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (grid[y * w + x] >= 10) {
        edge.push([SECTOR.lon0 + x, SECTOR.lat0 + y]);
        break;
      }
    }
  }
  const line = continuousEdge(edge, SECTOR.lon0, SECTOR.lon1);
  return {
    observed: j["Observation Time"],
    forecast: j["Forecast Time"],
    w,
    h,
    grid,
    edge: line,
    view: line.map(
      ([lon, lat]) => [lon, lat - HORIZON_DEG] as [number, number],
    ),
  };
}

export async function kp() {
  const [now, fc] = await Promise.all([
    get<{ time_tag: string; estimated_kp: number }[]>(
      "/json/planetary_k_index_1m.json",
      60,
    ),
    get<
      {
        time_tag: string;
        kp: number;
        observed: string;
        noaa_scale: string | null;
      }[]
    >("/products/noaa-planetary-k-index-forecast.json", 900),
  ]);
  const last = now[now.length - 1];
  // The official Kp is 3-hourly; the 1-minute estimate restarts each window, so the
  // headline uses the latest 3-hour value and the minute estimate rides along.
  const done = fc.filter(
    (x) =>
      x.observed !== "predicted" && Date.parse(`${x.time_tag}Z`) <= Date.now(),
  );
  const cur = done[done.length - 1];
  return {
    now: cur
      ? {
          at: `${cur.time_tag}Z`,
          kp: cur.kp,
          minute: last ? Math.round(last.estimated_kp * 100) / 100 : null,
        }
      : null,
    // Last 24 hours observed/estimated plus everything predicted.
    bars: fc
      .map((x) => ({
        at: `${x.time_tag}Z`,
        kp: x.kp,
        kind: x.observed as "observed" | "estimated" | "predicted",
      }))
      .filter(
        (x) =>
          x.kind === "predicted" ||
          Date.parse(x.at) > Date.now() - 27 * 3600_000,
      ),
  };
}

type Mag = {
  time_tag: string;
  active: boolean;
  bz_gsm: number | null;
  bt: number | null;
};
type Wind = {
  time_tag: string;
  active: boolean;
  proton_speed: number | null;
  proton_density: number | null;
};
let windMemo: { at: number; p: Promise<SolarWind> } | null = null;
export type SolarWind = {
  t: string;
  bz: number | null;
  bt: number | null;
  v: number | null;
  n: number | null;
}[];

/** The last 3 hours of solar wind in 5-minute means (memoized a minute; the feeds are 2 MB). */
export function solarWind(): Promise<SolarWind> {
  if (windMemo && Date.now() - windMemo.at < 60_000) return windMemo.p;
  const p = Promise.all([
    get<Mag[]>("/json/rtsw/rtsw_mag_1m.json", false),
    get<Wind[]>("/json/rtsw/rtsw_wind_1m.json", false),
  ]).then(([mag, wind]) => {
    const since = Date.now() - 3 * 3600_000;
    const bins = new Map<
      number,
      { bz: number[]; bt: number[]; v: number[]; n: number[] }
    >();
    const bin = (t: string) => {
      const ms = Date.parse(`${t}Z`);
      if (ms < since) return null;
      const k = Math.floor(ms / 300_000) * 300_000;
      if (!bins.has(k)) bins.set(k, { bz: [], bt: [], v: [], n: [] });
      return bins.get(k)!;
    };
    for (const m of mag) {
      if (!m.active) continue;
      const b = bin(m.time_tag);
      if (b && m.bz_gsm != null) b.bz.push(m.bz_gsm);
      if (b && m.bt != null) b.bt.push(m.bt);
    }
    for (const w of wind) {
      if (!w.active) continue;
      const b = bin(w.time_tag);
      if (b && w.proton_speed != null) b.v.push(w.proton_speed);
      if (b && w.proton_density != null) b.n.push(w.proton_density);
    }
    const avg = (a: number[], d = 1) =>
      a.length
        ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10 ** d) /
          10 ** d
        : null;
    return [...bins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, b]) => ({
        t: new Date(k).toISOString(),
        bz: avg(b.bz),
        bt: avg(b.bt),
        v: avg(b.v, 0),
        n: avg(b.n),
      }));
  });
  p.catch(() => (windMemo = null));
  windMemo = { at: Date.now(), p };
  return p;
}
