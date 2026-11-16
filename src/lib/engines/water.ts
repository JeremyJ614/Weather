import "server-only";

/**
 * Measured water for the Fishing Bite and Waterspout engines (post-launch A6): USGS stream and
 * lake gauges, NOAA's Great Lakes buoys and the Great Lakes satellite analysis (GLSEA, built
 * from the VIIRS and AVHRR passes), plus river flow against the day's normal. Every source is
 * free and fails soft: a source that doesn't answer is simply left out.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const FRESH_MS = 6 * 3600_000;

export type WaterSource = "gauge" | "buoy" | "satellite";
export type WaterObs = {
  lat: number;
  lon: number;
  c: number;
  src: WaterSource;
};

const inUs = (lat: number, lon: number) =>
  lat > 24 && lat < 50.5 && lon > -125.5 && lon < -66;

async function usgsTemps(): Promise<WaterObs[]> {
  const r = await fetch(
    "https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?parameter_code=00010&f=json&limit=10000&properties=value,time",
    {
      headers: UA,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok) return [];
  const d = (await r.json()) as {
    features?: {
      properties: { value: string; time: string };
      geometry: { coordinates: [number, number] } | null;
    }[];
  };
  const out: WaterObs[] = [];
  for (const f of d.features ?? []) {
    const c = Number(f.properties.value);
    const at = Date.parse(f.properties.time);
    if (!f.geometry || !Number.isFinite(c) || c < -1 || c > 38) continue;
    if (!(Date.now() - at < FRESH_MS)) continue;
    const [lon, lat] = f.geometry.coordinates;
    if (inUs(lat, lon)) out.push({ lat, lon, c, src: "gauge" });
  }
  return out;
}

/**
 * NDBC's latest observations: the Great Lakes buoys and lake stations (IDs 45xxx), or with
 * `ocean` every buoy and coastal station that reports water temperature.
 */
async function ndbc(ocean = false): Promise<WaterObs[]> {
  const r = await fetch(
    "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt",
    {
      headers: UA,
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) return [];
  const out: WaterObs[] = [];
  for (const line of (await r.text()).split("\n")) {
    if (line.startsWith("#") || (!ocean && !line.startsWith("45"))) continue;
    const p = line.trim().split(/\s+/);
    // STN LAT LON YYYY MM DD hh mm ... WTMP is column 18.
    const lat = Number(p[1]);
    const lon = Number(p[2]);
    const c = Number(p[18]);
    const at = Date.UTC(+p[3], +p[4] - 1, +p[5], +p[6], +p[7]);
    if (!Number.isFinite(c) || !inUs(lat, lon) || Date.now() - at > FRESH_MS)
      continue;
    out.push({ lat, lon, c, src: "buoy" });
  }
  return out;
}

/** GLSEA (NOAA GLERL): yesterday's satellite surface temperature of the Great Lakes, ~0.25°. */
async function glsea(): Promise<WaterObs[]> {
  const r = await fetch(
    "https://apps.glerl.noaa.gov/erddap/griddap/GLSEA_ACSPO_GCS.json?sst%5B(last)%5D%5B(41.3):18:(49.1)%5D%5B(-92.2):18:(-76)%5D",
    {
      headers: UA,
      next: { revalidate: 6 * 3600 },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!r.ok) return [];
  const d = (await r.json()) as {
    table: { rows: [string, number, number, number | null][] };
  };
  const out: WaterObs[] = [];
  for (const [, lat, lon, c] of d.table.rows)
    if (c !== null && Number.isFinite(c))
      out.push({ lat, lon, c, src: "satellite" });
  return out;
}

/** Every measured water temperature in the lower 48 right now (°C); `ocean` adds sea buoys. */
export async function waterObs(ocean = false): Promise<WaterObs[]> {
  const got = await Promise.all(
    [usgsTemps, () => ndbc(ocean), glsea].map((f) =>
      f().catch(() => [] as WaterObs[]),
    ),
  );
  return got.flat();
}

const miles = (aLat: number, aLon: number, bLat: number, bLon: number) =>
  69 *
  Math.hypot(aLat - bLat, (aLon - bLon) * Math.cos((aLat * Math.PI) / 180));

/** A lookup by 1° bins so the national lattice can ask "what is near here?" quickly. */
export function waterIndex(obs: WaterObs[]) {
  const bins = new Map<string, WaterObs[]>();
  const key = (lat: number, lon: number) =>
    `${Math.floor(lat)},${Math.floor(lon)}`;
  for (const o of obs) {
    const k = key(o.lat, o.lon);
    (bins.get(k) ?? bins.set(k, []).get(k)!).push(o);
  }
  /**
   * Measured water near a spot (°F): inverse-distance weighted within `reach` miles, and how
   * much to trust it over an estimate (1 within 15 miles of a measurement, fading to 0 at reach).
   */
  return (lat: number, lon: number, reach = 40) => {
    let sw = 0;
    let sv = 0;
    let near = Infinity;
    let src: WaterSource | null = null;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const o of bins.get(key(lat + a, lon + b)) ?? []) {
          const d = miles(lat, lon, o.lat, o.lon);
          if (d > reach) continue;
          const w = 1 / Math.max(d, 1) ** 2;
          sw += w;
          sv += w * o.c;
          if (d < near) {
            near = d;
            src = o.src;
          }
        }
    if (!sw) return null;
    return {
      f: ((sv / sw) * 9) / 5 + 32,
      trust: Math.min(1, Math.max(0, (reach - near) / (reach - 15))),
      miles: Math.round(near),
      src: src!,
    };
  };
}

export type RiverFlow = {
  name: string;
  miles: number;
  cfs: number;
  /** Today's normal (median) flow for this date, and the 95th percentile. */
  median: number;
  p95: number | null;
  /** Change over the last three hours (share, 0.2 = up 20%). */
  rise: number;
  /** 0.4–1: how much high, rising water cuts the bite on this river. */
  factor: number;
};

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** The nearest USGS river gauge within ~10 miles, its flow now and against its normal for today. */
export async function riverFlow(
  lat: number,
  lon: number,
): Promise<RiverFlow | null> {
  const r = await fetch(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&parameterCd=00060&siteStatus=active&period=PT4H&siteType=ST&bBox=${(lon - 0.2).toFixed(3)},${(lat - 0.15).toFixed(3)},${(lon + 0.2).toFixed(3)},${(lat + 0.15).toFixed(3)}`,
    {
      headers: UA,
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json()) as {
    value?: {
      timeSeries?: {
        sourceInfo: {
          siteName: string;
          siteCode: { value: string }[];
          geoLocation: {
            geogLocation: { latitude: number; longitude: number };
          };
        };
        values: { value: { value: string; dateTime: string }[] }[];
      }[];
    };
  };
  let best: {
    site: string;
    name: string;
    d: number;
    cfs: number;
    was: number;
  } | null = null;
  for (const s of d.value?.timeSeries ?? []) {
    const v = s.values[0]?.value ?? [];
    const last = Number(v.at(-1)?.value);
    const first = Number(v[0]?.value);
    if (!Number.isFinite(last) || last < 0) continue;
    if (Date.now() - Date.parse(v.at(-1)!.dateTime) > FRESH_MS) continue;
    const g = s.sourceInfo.geoLocation.geogLocation;
    const dd = miles(lat, lon, g.latitude, g.longitude);
    if (dd <= 10 && (!best || dd < best.d))
      best = {
        site: s.sourceInfo.siteCode[0].value,
        name: titleCase(s.sourceInfo.siteName),
        d: dd,
        cfs: last,
        was: Number.isFinite(first) && first > 0 ? first : last,
      };
  }
  if (!best) return null;
  const st = await fetch(
    `https://waterservices.usgs.gov/nwis/stat/?format=rdb&sites=${best.site}&statReportType=daily&statTypeCd=p50,p95&parameterCd=00060`,
    {
      headers: UA,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => null);
  if (!st?.ok) return null;
  const now = new Date();
  const [m, day] = [now.getUTCMonth() + 1, now.getUTCDate()];
  let median = NaN;
  let p95: number | null = null;
  let cols: string[] = [];
  for (const line of (await st.text()).split("\n")) {
    if (line.startsWith("agency_cd")) cols = line.split("\t");
    if (line.startsWith("#") || !line.startsWith("USGS")) continue;
    const c = line.split("\t");
    const col = (name: string) => c[cols.indexOf(name)];
    if (+col("month_nu") === m && +col("day_nu") === day) {
      median = Number(col("p50_va"));
      p95 = col("p95_va") ? Number(col("p95_va")) : null;
      break;
    }
  }
  if (!Number.isFinite(median) || median <= 0) return null;
  const rise = best.cfs / best.was - 1;
  const ratio = best.cfs / median;
  // Normal to 1.5× normal fishes fine; muddy high water shuts the bite off, more so on the rise.
  let factor = ratio <= 1.5 ? 1 : 1 - Math.min(0.5, (ratio - 1.5) * 0.2);
  if (p95 && best.cfs > p95) factor = Math.min(factor, 0.6);
  if (rise > 0.15 && ratio > 1) factor *= 0.85;
  return {
    name: best.name,
    miles: Math.round(best.d),
    cfs: Math.round(best.cfs),
    median: Math.round(median),
    p95: p95 && Number.isFinite(p95) ? Math.round(p95) : null,
    rise: Math.round(rise * 100) / 100,
    factor: Math.round(Math.max(0.4, factor) * 100) / 100,
  };
}
