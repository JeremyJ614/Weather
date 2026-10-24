import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { dedupe, parseRer, type WxRecord } from "./records";

/**
 * Climate Extremes Tracker data: the most extreme readings at every U.S. airport weather
 * station right now (ASOS, through the Iowa Environmental Mesonet) and the records the
 * Weather Service has reported this week (Record Event Reports).
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const IEM =
  "https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&country=US";
const NWS = "https://api.weather.gov";

export type Station = {
  id: string;
  name: string;
  st: string;
  lat: number;
  lon: number;
  value: number;
  /** When the reading was taken (ISO). */
  at: string;
};
export type Extremes = {
  /** Lower 48 only, and everywhere (Alaska, Hawaii and the territories too). */
  scopes: Record<"lower48" | "all", Record<Metric, Station[]>>;
  stations: number;
  at: string;
};
export type Metric =
  "hot" | "cold" | "gust" | "humid" | "pressure" | "dayHigh" | "dayLow";

const title = (s: string) =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export type Row = {
  station: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  utc_valid: string | null;
  local_date: string | null;
  tmpf: number | null;
  max_tmpf: number | null;
  min_tmpf: number | null;
  dwpf: number | null;
  gust: number | null;
  mslp: number | null;
};

/** The lower 48 and DC (offshore platforms report as "GM" and are left out). */
const LOWER48 = new Set(
  "AL AZ AR CA CO CT DE DC FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);
const STATES = new Set([...LOWER48, "AK", "HI", "PR", "GU", "VI", "AS", "MP"]);

/**
 * A neighbor check: a reading far off the median of its five nearest stations (within
 * about 150 miles) is a broken sensor, not a record, and is left out.
 */
export function buddyOk(
  rows: Row[],
  get: (r: Row) => number | null,
  limit: number,
) {
  const pts = rows.flatMap((r) => {
    const v = get(r);
    return v != null && Number.isFinite(v) ? [{ r, v }] : [];
  });
  const ok = new Set<Row>();
  for (const p of pts) {
    const k = Math.cos((p.r.lat * Math.PI) / 180);
    const near = pts
      .flatMap((q) => {
        if (q === p) return [];
        const d = (q.r.lat - p.r.lat) ** 2 + ((q.r.lon - p.r.lon) * k) ** 2;
        return d < 4.7 ? [{ d, v: q.v }] : [];
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((q) => q.v)
      .sort((a, b) => a - b);
    // Too few neighbors to judge (an island, a remote station): trust it.
    if (near.length < 3 || Math.abs(p.v - near[near.length >> 1]) <= limit)
      ok.add(p.r);
  }
  return ok;
}

type Measure = {
  get: (r: Row) => number | null;
  /** Physically possible values. */
  range: [number, number];
  /** 1: highest first; -1: lowest first. */
  dir: 1 | -1;
  /** The neighbor check's limit, or 0 for none (gusts are local by nature). */
  buddy: number;
  conv?: (v: number) => number;
  /** Today's high and low read only stations on the common local day. */
  today?: boolean;
};
const MEASURES: Record<Metric, Measure> = {
  hot: { get: (r) => r.tmpf, range: [-80, 135], dir: 1, buddy: 18 },
  cold: { get: (r) => r.tmpf, range: [-80, 135], dir: -1, buddy: 18 },
  gust: {
    get: (r) => r.gust,
    range: [1, 200],
    dir: 1,
    buddy: 0,
    conv: (v) => v * 1.15078,
  },
  humid: { get: (r) => r.dwpf, range: [-60, 95], dir: 1, buddy: 15 },
  pressure: { get: (r) => r.mslp, range: [870, 1090], dir: -1, buddy: 8 },
  dayHigh: {
    get: (r) => r.max_tmpf,
    range: [-80, 135],
    dir: 1,
    buddy: 18,
    today: true,
  },
  dayLow: {
    get: (r) => r.min_tmpf,
    range: [-80, 135],
    dir: -1,
    buddy: 18,
    today: true,
  },
};

let places: ReturnType<typeof parsePlaces> | null = null;
/**
 * Oil and gas platforms in the Gulf report as Texas and Louisiana stations; one more than
 * 20 miles from any town there is out at sea, not a place anyone lives.
 */
function offshore(r: Row) {
  if (r.lat > 30.3 || r.lon < -98 || r.lon > -81) return false;
  places ??= parsePlaces(PLACES);
  const n = nearestPlace(places, r.lat, r.lon, 1500);
  return !n || n.miles > 20;
}

/** The top five per measure from the latest observations (quality-checked). */
export function rank(rows: Row[], now = Date.now()): Extremes["scopes"] {
  // A reading older than 90 minutes is a station that has stopped reporting.
  const live = rows.filter(
    (r) =>
      r.utc_valid &&
      now - Date.parse(r.utc_valid) < 90 * 60_000 &&
      !offshore(r),
  );
  const top = (list: Row[], m: Measure): Station[] => {
    const sane = m.buddy ? buddyOk(list, m.get, m.buddy) : null;
    return list
      .flatMap((r) => {
        const v = m.get(r);
        if (
          v == null ||
          !Number.isFinite(v) ||
          v < m.range[0] ||
          v > m.range[1]
        )
          return [];
        if (sane && !sane.has(r)) return [];
        return [
          {
            id: r.station,
            name: title(r.name),
            st: r.state,
            lat: r.lat,
            lon: r.lon,
            value: Math.round((m.conv ? m.conv(v) : v) * 10) / 10,
            at: r.utc_valid!,
          },
        ];
      })
      .sort((a, b) => m.dir * (b.value - a.value))
      .slice(0, 5);
  };
  const scope = (list: Row[]) => {
    const days = list
      .map((r) => r.local_date ?? "")
      .filter(Boolean)
      .sort();
    const day = days[days.length >> 1];
    const today = list.filter((r) => r.local_date === day);
    return Object.fromEntries(
      (Object.keys(MEASURES) as Metric[]).map((k) => [
        k,
        top(MEASURES[k].today ? today : list, MEASURES[k]),
      ]),
    ) as Record<Metric, Station[]>;
  };
  return {
    lower48: scope(live.filter((r) => LOWER48.has(r.state))),
    all: scope(live.filter((r) => STATES.has(r.state))),
  };
}

/** Right now, at every ASOS station in the country (about 2,600). */
export async function liveExtremes(): Promise<Extremes | null> {
  const r = await fetch(IEM, {
    headers: UA,
    // About 3 MB: too big for the data cache; the page itself is rebuilt every 10 minutes.
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const { data } = (await r.json()) as { data: Row[] };
  return {
    scopes: rank(data),
    stations: data.length,
    at: new Date().toISOString(),
  };
}

const officeStates = new Map<string, string>();
async function officeState(id: string) {
  if (officeStates.has(id)) return officeStates.get(id)!;
  const r = await fetch(`${NWS}/offices/${id}`, {
    headers: UA,
    next: { revalidate: 30 * 86400 },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const st = r?.ok
    ? (((await r.json()) as { address?: { addressRegion?: string } }).address
        ?.addressRegion ?? "")
    : "";
  officeStates.set(id, st);
  return st;
}

/** Records reported over the last `days` days, newest first, one per place and day. */
export async function weekRecords(days = 7): Promise<WxRecord[]> {
  const r = await fetch(`${NWS}/products/types/RER`, {
    headers: UA,
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const list = (
    (await r.json()) as {
      "@graph": { id: string; issuanceTime: string; issuingOffice: string }[];
    }
  )["@graph"]
    .filter((p) => Date.now() - Date.parse(p.issuanceTime) < days * 86400_000)
    // Oldest first, so a later correction replaces the first report.
    .sort((a, b) => a.issuanceTime.localeCompare(b.issuanceTime))
    .slice(-150);
  // Kept in issuance order, whichever product answers first.
  const parsed: WxRecord[][] = list.map(() => []);
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < list.length) {
        const k = next++;
        const p = list[k];
        const t = await fetch(`${NWS}/products/${p.id}`, {
          headers: UA,
          // A product never changes once issued.
          next: { revalidate: 14 * 86400 },
          signal: AbortSignal.timeout(10000),
        })
          .then((x) => (x.ok ? x.json() : null))
          .catch(() => null);
        if (!t?.productText) continue;
        const st = await officeState(p.issuingOffice.slice(1));
        parsed[k] = parseRer(t.productText, p.issuanceTime, st);
      }
    }),
  );
  const since = new Date(Date.now() - days * 86400_000)
    .toISOString()
    .slice(0, 10);
  return dedupe(parsed.flat().filter((x) => x.day >= since));
}
