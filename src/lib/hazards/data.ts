import "server-only";
import type { FeatureCollection, Geometry } from "geojson";
import { pick, type Colors } from "@/lib/colors/pick";
import { HAZ_KINDS, USDM, hazardKind } from "./style";

/**
 * Hazards & Droughts data: CPC's 3–7 and 8–14 day hazards outlooks (NOAA map service),
 * the weekly US Drought Monitor with its national trend (Esri Living Atlas copy of the
 * USDM shapefiles), and what applies at one place.
 */
const CPC =
  "https://mapservices.weather.noaa.gov/vector/rest/services/hazards/cpc_weather_hazards/MapServer";
const USDM_FS =
  "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/US_Drought_Intensity_v1/FeatureServer";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
/** CPC layers by outlook period. */
const LAYERS: { id: number; period: "3-7" | "8-14" }[] = [
  { id: 1, period: "3-7" },
  { id: 4, period: "3-7" },
  { id: 7, period: "3-7" },
  { id: 3, period: "8-14" },
  { id: 6, period: "8-14" },
  { id: 8, period: "8-14" },
];

type FC = FeatureCollection<Geometry, Record<string, unknown>>;
const geo = `outFields=*&returnGeometry=true&maxAllowableOffset=0.04&geometryPrecision=3&outSR=4326&f=geojson`;
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

export type Hazard = {
  id: string;
  label: string;
  kind: string;
  period: "3-7" | "8-14";
  start: string | null;
  end: string | null;
};
const iso = (v: unknown) =>
  typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : null;

/** Both CPC hazards outlooks as colored GeoJSON plus a deduplicated list. */
export async function cpcHazards(colors: Colors = {}) {
  const layers = await Promise.all(
    LAYERS.map(async (l) => ({
      ...l,
      fc: await get<FC>(`${CPC}/${l.id}/query?where=1%3D1&${geo}`, 1800),
    })),
  );
  const features: FC["features"] = [];
  const seen = new Map<string, Hazard>();
  for (const l of layers)
    for (const f of l.fc?.features ?? []) {
      const p = f.properties ?? {};
      const label = String(p.label ?? "Hazard");
      const kind = hazardKind(label);
      const h: Hazard = {
        id: "",
        label,
        kind,
        period: l.period,
        start: iso(p.start_date),
        end: iso(p.end_date),
      };
      h.id = `${h.period}|${label}|${h.start}|${h.end}`;
      seen.set(h.id, h);
      features.push({
        ...f,
        properties: {
          label,
          period: l.period,
          start: h.start,
          end: h.end,
          color: pick(colors, `haz:${kind}`, HAZ_KINDS[kind].color),
        },
      });
    }
  return {
    geo: { type: "FeatureCollection", features } as FC,
    list: [...seen.values()].sort(
      (a, b) =>
        (a.start ?? "").localeCompare(b.start ?? "") ||
        a.label.localeCompare(b.label),
    ),
  };
}

export type DroughtNow = {
  week: string | null;
  /** Percent of the US in each category or worse (D0–D4). */
  national: number[];
  geo: FC;
};

export async function droughtNow(colors: Colors = {}): Promise<DroughtNow> {
  const fc = await get<FC>(`${USDM_FS}/3/query?where=1%3D1&${geo}`, 21600);
  const p = fc?.features[0]?.properties ?? {};
  return {
    week: typeof p.period === "string" ? p.period : null,
    national: ["D0_D4", "D1_D4", "D2_D4", "D3_D4", "d4"].map(
      (k) => Number(p[k]) || 0,
    ),
    geo: {
      type: "FeatureCollection",
      features: (fc?.features ?? []).map((f) => {
        const dm = Number(f.properties?.dm);
        return {
          ...f,
          properties: {
            dm,
            color: pick(colors, `usdm:${dm}`, USDM[dm]?.color ?? "#888888"),
          },
        };
      }),
    },
  };
}

/** The share of the US in drought (D1–D4) and worse, week by week over ~3 months. */
export async function droughtTrend(): Promise<
  { week: string; d0: number; d1: number; d2: number; d3: number; d4: number }[]
> {
  const since = new Date(Date.now() - 98 * 86400000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const j = await get<{ features?: { attributes: Record<string, unknown> }[] }>(
    `${USDM_FS}/2/query?where=${encodeURIComponent(`period>='${since}' AND dm=0`)}&outFields=period,D0_D4,D1_D4,D2_D4,D3_D4,d4&returnGeometry=false&orderByFields=period&f=json`,
    21600,
  );
  return (j?.features ?? []).map(({ attributes: a }) => ({
    week: String(a.period),
    d0: Number(a.D0_D4) || 0,
    d1: Number(a.D1_D4) || 0,
    d2: Number(a.D2_D4) || 0,
    d3: Number(a.D3_D4) || 0,
    d4: Number(a.d4) || 0,
  }));
}

const FIPS: Record<string, string> = Object.fromEntries(
  "AL01 AK02 AZ04 AR05 CA06 CO08 CT09 DE10 DC11 FL12 GA13 HI15 ID16 IL17 IN18 IA19 KS20 KY21 LA22 ME23 MD24 MA25 MI26 MN27 MS28 MO29 MT30 NE31 NV32 NH33 NJ34 NM35 NY36 NC37 ND38 OH39 OK40 OR41 PA42 RI44 SC45 SD46 TN47 TX48 UT49 VT50 VA51 WA53 WV54 WI55 WY56 PR72"
    .split(" ")
    .map((x) => [x.slice(0, 2), x.slice(2)]),
);

/** USDM state statistics CSV (categorical percent of area) → rows, newest first. */
export function parseStateCsv(csv: string) {
  const [head, ...rows] = csv.trim().split(/\r?\n/);
  const cols = head.split(",");
  const at = (k: string) => cols.indexOf(k);
  return rows
    .map((r) => r.split(","))
    .filter((c) => c.length === cols.length)
    .map((c) => ({
      week: c[at("MapDate")],
      none: Number(c[at("None")]),
      d: ["D0", "D1", "D2", "D3", "D4"].map((k) => Number(c[at(k)])),
    }))
    .sort((a, b) => b.week.localeCompare(a.week));
}

export type Here = {
  state: string | null;
  dm: number | null;
  hazards: Hazard[];
  stateWeeks: ReturnType<typeof parseStateCsv>;
};

/** What applies at one place: its drought category, its state's drought, the hazards over it. */
export async function hazardsHere(lat: number, lon: number): Promise<Here> {
  const pt = `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&f=json`;
  type Attrs = { features?: { attributes: Record<string, unknown> }[] };
  const [usdm, point, ...cpc] = await Promise.all([
    get<Attrs>(`${USDM_FS}/3/query?${pt}&outFields=dm`, 21600),
    get<{
      properties?: { relativeLocation?: { properties?: { state?: string } } };
    }>(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      86400,
    ),
    ...LAYERS.map((l) =>
      get<Attrs>(
        `${CPC}/${l.id}/query?${pt}&outFields=label,start_date,end_date`,
        1800,
      ),
    ),
  ]);
  const dms = (usdm?.features ?? [])
    .map((f) => Number(f.attributes.dm))
    .filter(Number.isFinite);
  const state = point?.properties?.relativeLocation?.properties?.state ?? null;
  const hazards = new Map<string, Hazard>();
  cpc.forEach((j, i) => {
    for (const f of j?.features ?? []) {
      const label = String(f.attributes.label ?? "Hazard");
      const h: Hazard = {
        id: "",
        label,
        kind: hazardKind(label),
        period: LAYERS[i].period,
        start: iso(f.attributes.start_date),
        end: iso(f.attributes.end_date),
      };
      h.id = `${h.period}|${label}|${h.start}|${h.end}`;
      hazards.set(h.id, h);
    }
  });
  let stateWeeks: Here["stateWeeks"] = [];
  if (state && FIPS[state]) {
    const end = new Date();
    const start = new Date(end.getTime() - 84 * 86400000);
    const f = (d: Date) =>
      `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    try {
      const r = await fetch(
        `https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=${FIPS[state]}&startdate=${f(start)}&enddate=${f(end)}&statisticsType=2`,
        {
          headers: UA,
          next: { revalidate: 21600 },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (r.ok) stateWeeks = parseStateCsv(await r.text());
    } catch {}
  }
  return {
    state,
    dm: dms.length ? Math.max(...dms) : null,
    hazards: [...hazards.values()].sort((a, b) =>
      (a.start ?? "").localeCompare(b.start ?? ""),
    ),
    stateWeeks,
  };
}
