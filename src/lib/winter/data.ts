import "server-only";
import type { FeatureCollection, Geometry } from "geojson";
import { pick, type Colors } from "@/lib/colors/pick";
import { PROB, PROB_KINDS, WINTER_EVENTS, type ProbKind } from "./style";

/**
 * Winter Center data: WSSI impact images and the national snow analysis (as map overlays,
 * proxied because WPC sends no CORS headers), WPC's day 1–3 snow and ice odds (vector),
 * winter alerts, an hour-by-hour timeline and city snowfall (Open-Meteo).
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const WSSI = "https://www.wpc.ncep.noaa.gov/wwd/wssi/images";
const PWPF =
  "https://mapservices.weather.noaa.gov/vector/rest/services/precip/wpc_prob_winter_precip/MapServer";
const NOHRSC =
  "https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export";
type FC = FeatureCollection<Geometry, Record<string, unknown>>;

/** WPC's declared WSSI image extent, and the box we request the snow analysis for. */
export const WSSI_BOUNDS: [number, number, number, number] = [
  -125.811668332, 24.714103649, -64.964629385, 57.560767331,
];
export const CONUS: [number, number, number, number] = [
  -125.5, 23.5, -66, 50.5,
];
const nohrsc = (layer: number) =>
  `${NOHRSC}?bbox=${CONUS.join(",")}&bboxSR=4326&imageSR=3857&size=1400,900&format=png32&transparent=true&layers=show:${layer}&f=image`;

/** Image overlays by id: where each comes from and its bounds (west, south, east, north). */
export const OVERLAYS: Record<
  string,
  {
    label: string;
    note: string;
    url: string;
    bounds: [number, number, number, number];
  }
> = {
  "wssi-overall": {
    label: "Winter impact",
    note: "WSSI storm-total impact: limited, minor, moderate, major, extreme.",
    url: `${WSSI}/web_CONUS_WSSI_Maximum_Overall.png`,
    bounds: WSSI_BOUNDS,
  },
  "wssi-snow": {
    label: "Snow amount impact",
    note: "Impact from snowfall alone.",
    url: `${WSSI}/web_CONUS_WSSI_Maximum_Snow_Amount.png`,
    bounds: WSSI_BOUNDS,
  },
  "wssi-ice": {
    label: "Ice impact",
    note: "Impact from freezing rain and ice loading.",
    url: `${WSSI}/web_CONUS_WSSI_Maximum_Ice_Accumulation.png`,
    bounds: WSSI_BOUNDS,
  },
  "wssi-blowing": {
    label: "Blowing snow",
    note: "Drifting snow and lost visibility.",
    url: `${WSSI}/web_CONUS_WSSI_Maximum_Blowing_Snow.png`,
    bounds: WSSI_BOUNDS,
  },
  "snow-depth": {
    label: "Snow on the ground",
    note: "Modelled snow depth now (NOHRSC).",
    url: nohrsc(0),
    bounds: CONUS,
  },
  "snow-swe": {
    label: "Water in the snowpack",
    note: "Snow water equivalent now (NOHRSC).",
    url: nohrsc(4),
    bounds: CONUS,
  },
};

async function get<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: UA,
      next: { revalidate },
      signal: AbortSignal.timeout(20000),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const layerOf = (day: number, kind: ProbKind) =>
  (day - 1) * 5 + PROB_KINDS[kind].offset;

/** One day's odds of a snow or ice amount, as colored GeoJSON. */
export async function probMap(
  day: number,
  kind: ProbKind,
  colors: Colors = {},
): Promise<FC> {
  const fc = await get<FC>(
    `${PWPF}/${layerOf(day, kind)}/query?where=dn%3E%3D1&outFields=dn,outlook&returnGeometry=true&maxAllowableOffset=0.03&geometryPrecision=3&outSR=4326&f=geojson`,
    1800,
  );
  return {
    type: "FeatureCollection",
    features: (fc?.features ?? [])
      .sort((a, b) => Number(a.properties?.dn) - Number(b.properties?.dn))
      .map((f) => {
        const dn = Math.round(Number(f.properties?.dn));
        return {
          ...f,
          properties: {
            dn,
            label: PROB[dn - 1]?.label ?? "",
            color: pick(
              colors,
              `winter:prob:${dn}`,
              PROB[dn - 1]?.color ?? "#888888",
            ),
          },
        };
      }),
  };
}

/** Highest odds anywhere for each day and amount (0 = under 10%). */
export async function probSummary(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    [1, 2, 3].flatMap((day) =>
      (Object.keys(PROB_KINDS) as ProbKind[]).map(async (kind) => {
        const j = await get<{ features?: { attributes: { dn: number } }[] }>(
          `${PWPF}/${layerOf(day, kind)}/query?where=1%3D1&outFields=dn&returnGeometry=false&returnDistinctValues=true&f=json`,
          1800,
        );
        out[`${day}:${kind}`] = Math.max(
          0,
          ...(j?.features ?? []).map((f) => Math.round(f.attributes.dn) || 0),
        );
      }),
    ),
  );
  return out;
}

export type WinterAlert = { event: string; count: number; states: string[] };

/** Every winter alert in effect nationally, grouped by type, most serious first. */
export async function nationalWinterAlerts(): Promise<WinterAlert[] | null> {
  const j = await get<{
    features?: {
      properties: { event: string; geocode?: { UGC?: string[] } };
    }[];
  }>(
    `https://api.weather.gov/alerts/active?status=actual&event=${encodeURIComponent(WINTER_EVENTS.join(","))}`,
    300,
  );
  if (!j) return null;
  const by = new Map<string, { count: number; states: Set<string> }>();
  for (const f of j.features ?? []) {
    const e = by.get(f.properties.event) ?? {
      count: 0,
      states: new Set<string>(),
    };
    e.count++;
    for (const u of f.properties.geocode?.UGC ?? [])
      e.states.add(u.slice(0, 2));
    by.set(f.properties.event, e);
  }
  return [...by]
    .map(([event, v]) => ({
      event,
      count: v.count,
      states: [...v.states].sort(),
    }))
    .sort(
      (a, b) => WINTER_EVENTS.indexOf(a.event) - WINTER_EVENTS.indexOf(b.event),
    );
}

export type WinterHere = {
  alerts: { event: string; headline: string; ends: string | null }[];
  hours: { t: string; snow: number; temp: number; pop: number; code: number }[];
  days: { d: string; snow: number; low: number; high: number }[];
};

/** Winter alerts and an hour-by-hour (72 h) and day-by-day (7 d) snow picture at a place. */
export async function winterHere(
  lat: number,
  lon: number,
): Promise<WinterHere> {
  const [alerts, om] = await Promise.all([
    get<{ features?: { properties: Record<string, unknown> }[] }>(
      `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
      300,
    ),
    get<{
      hourly?: {
        time: string[];
        snowfall: number[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code: number[];
      };
      daily?: {
        time: string[];
        snowfall_sum: number[];
        temperature_2m_min: number[];
        temperature_2m_max: number[];
      };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=snowfall,temperature_2m,precipitation_probability,weather_code&daily=snowfall_sum,temperature_2m_min,temperature_2m_max&forecast_hours=72&forecast_days=7&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`,
      1800,
    ),
  ]);
  const h = om?.hourly;
  const d = om?.daily;
  return {
    alerts: (alerts?.features ?? [])
      .map((f) => f.properties)
      .filter((p) => WINTER_EVENTS.includes(String(p.event)))
      .map((p) => ({
        event: String(p.event),
        headline: String(p.headline ?? ""),
        ends: (p.ends ?? p.expires ?? null) as string | null,
      })),
    hours: h
      ? h.time.map((t, i) => ({
          t,
          snow: h.snowfall[i] ?? 0,
          temp: Math.round(h.temperature_2m[i]),
          pop: h.precipitation_probability[i] ?? 0,
          code: h.weather_code[i] ?? 0,
        }))
      : [],
    days: d
      ? d.time.map((t, i) => ({
          d: t,
          snow: d.snowfall_sum[i] ?? 0,
          low: Math.round(d.temperature_2m_min[i]),
          high: Math.round(d.temperature_2m_max[i]),
        }))
      : [],
  };
}

/** Snow-belt and mountain cities for the national snowfall board. */
export const CITIES: [string, number, number][] = [
  ["Buffalo, NY", 42.89, -78.88],
  ["Syracuse, NY", 43.05, -76.15],
  ["Erie, PA", 42.13, -80.09],
  ["Cleveland, OH", 41.5, -81.69],
  ["Detroit, MI", 42.33, -83.05],
  ["Marquette, MI", 46.55, -87.4],
  ["Chicago, IL", 41.88, -87.63],
  ["Milwaukee, WI", 43.04, -87.91],
  ["Minneapolis, MN", 44.98, -93.27],
  ["Duluth, MN", 46.79, -92.1],
  ["Fargo, ND", 46.88, -96.79],
  ["Des Moines, IA", 41.59, -93.62],
  ["Omaha, NE", 41.26, -95.93],
  ["Denver, CO", 39.74, -104.99],
  ["Salt Lake City, UT", 40.76, -111.89],
  ["Jackson, WY", 43.48, -110.76],
  ["Bozeman, MT", 45.68, -111.04],
  ["Boise, ID", 43.62, -116.2],
  ["Spokane, WA", 47.66, -117.43],
  ["Lake Tahoe, CA", 39.1, -120.03],
  ["Flagstaff, AZ", 35.2, -111.65],
  ["Boston, MA", 42.36, -71.06],
  ["New York, NY", 40.71, -74.01],
  ["Philadelphia, PA", 39.95, -75.17],
  ["Washington, DC", 38.91, -77.04],
  ["Pittsburgh, PA", 40.44, -79.99],
  ["Burlington, VT", 44.48, -73.21],
  ["Portland, ME", 43.66, -70.26],
  ["Anchorage, AK", 61.22, -149.9],
  ["Fairbanks, AK", 64.84, -147.72],
];

/** Each city's snowfall over the next 5 days (inches), most first. */
export async function citySnow(): Promise<
  { city: string; total: number; days: number[] }[] | null
> {
  const j = await get<{ daily: { snowfall_sum: number[] } }[]>(
    `https://api.open-meteo.com/v1/forecast?latitude=${CITIES.map((c) => c[1]).join(",")}&longitude=${CITIES.map((c) => c[2]).join(",")}&daily=snowfall_sum&forecast_days=5&precipitation_unit=inch&timezone=auto`,
    3600,
  );
  if (!Array.isArray(j)) return null;
  return CITIES.map(([city], i) => {
    const days = (j[i]?.daily?.snowfall_sum ?? []).map(
      (x) => Math.round((x ?? 0) * 10) / 10,
    );
    return {
      city,
      days,
      total: Math.round(days.reduce((a, x) => a + x, 0) * 10) / 10,
    };
  }).sort((a, b) => b.total - a.total);
}
