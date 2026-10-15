import "server-only";

/**
 * River & Flood Gauges: every NWS river gauge's observed stage and flood category (NOAA's
 * river-gauge map service), the forecast layers out to 5 days, and one gauge's hydrograph
 * (National Water Prediction Service).
 */
const RIV =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
export const LEVELS = ["action", "minor", "moderate", "major"] as const;
export type Level = (typeof LEVELS)[number] | "normal";

export type Gauge = {
  id: string;
  name: string;
  river: string;
  state: string;
  level: Level;
  stage: number | null;
  units: string;
  action: number | null;
  flood: number | null;
  moderate: number | null;
  major: number | null;
  observed: string | null;
  lat: number;
  lon: number;
};

const n = (v: unknown) => {
  const x = Number(v);
  return v === "" || v == null || !Number.isFinite(x) ? null : x;
};
const lvl = (s: unknown): Level =>
  LEVELS.includes(s as (typeof LEVELS)[number]) ? (s as Level) : "normal";

export function toGauge(a: Record<string, unknown>): Gauge {
  const g: Gauge = {
    id: String(a.gaugelid).toUpperCase(),
    name: String(a.location || a.gaugelid),
    river: String(a.waterbody ?? ""),
    state: String(a.state ?? ""),
    level: lvl(a.status),
    stage: n(a.observed ?? a.forecast),
    units: String(a.units || "ft"),
    action: n(a.action),
    flood: n(a.flood),
    moderate: n(a.moderate),
    major: n(a.major),
    observed: a.obstime
      ? `${String(a.obstime).replace(" ", "T")}Z`
      : a.fcsttime
        ? `${String(a.fcsttime).replace(" ", "T")}Z`
        : null,
    lat: Number(a.latitude),
    lon: Number(a.longitude),
  };
  // Some lake gauges report stages as elevations but thresholds as tiny depths (Devils
  // Lake: 50 ft against a 0.1 ft flood stage). No real gauge runs 5x past major.
  const top = Math.max(
    g.action ?? 0,
    g.flood ?? 0,
    g.moderate ?? 0,
    g.major ?? 0,
  );
  if (g.stage != null && top > 0 && g.stage > top * 5)
    g.action = g.flood = g.moderate = g.major = null;
  return g;
}

async function query(
  layer: number,
  where: string,
  extra = "",
  revalidate = 600,
): Promise<Gauge[]> {
  const r = await fetch(
    `${RIV}/${layer}/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=false${extra}&f=json`,
    { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw new Error(`gauges ${r.status}`);
  const j = (await r.json()) as {
    features?: { attributes: Record<string, unknown> }[];
  };
  return (j.features ?? []).map((f) => toGauge(f.attributes));
}

/**
 * How bad a gauge is: its flood category first, then how far it sits past the stage that
 * starts that category, as a share of the gap to the next one.
 */
export function severity(g: Gauge): number {
  const rank = LEVELS.indexOf(g.level as (typeof LEVELS)[number]) + 1; // 0 normal … 4 major
  const steps = [g.action, g.flood, g.moderate, g.major];
  const from = rank ? steps[rank - 1] : null;
  const to = rank < 4 ? steps[rank] : null;
  const past =
    g.stage != null && from != null
      ? (g.stage - from) / Math.max(0.5, (to ?? from + 5) - from)
      : 0;
  return rank * 10 + Math.max(0, Math.min(9.9, past * 10));
}

const ELEVATED = "status in ('action','minor','moderate','major')";

/** Gauges at action stage or worse, worst first. */
export async function elevated(): Promise<Gauge[]> {
  return (await query(0, ELEVATED)).sort((a, b) => severity(b) - severity(a));
}

/** Gauges forecast to reach minor flooding or worse within 5 days, with when. */
export async function forecastFloods(): Promise<
  (Gauge & { when: string | null })[]
> {
  const days = await Promise.all(
    [1, 2, 3, 4, 5].map((l) =>
      query(l, "status in ('minor','moderate','major')").catch(() => []),
    ),
  );
  const best = new Map<string, Gauge & { when: string | null }>();
  days.forEach((list) =>
    list.forEach((g) => {
      const had = best.get(g.id);
      if (!had || severity(g) > severity(had))
        best.set(g.id, { ...g, when: g.observed });
    }),
  );
  return [...best.values()].sort((a, b) => severity(b) - severity(a));
}

/** The gauges nearest a place (within about 75 miles), nearest first. */
export async function nearby(
  lat: number,
  lon: number,
): Promise<(Gauge & { miles: number })[]> {
  const env = `&geometry=${lon - 1.2},${lat - 1},${lon + 1.2},${lat + 1}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
  const list = await query(
    0,
    "status not in ('out_of_service','obs_not_current')",
    env,
    900,
  );
  const r = Math.PI / 180;
  return list
    .map((g) => {
      const h =
        Math.sin(((g.lat - lat) * r) / 2) ** 2 +
        Math.cos(lat * r) *
          Math.cos(g.lat * r) *
          Math.sin(((g.lon - lon) * r) / 2) ** 2;
      return { ...g, miles: Math.round(2 * 3958.8 * Math.asin(Math.sqrt(h))) };
    })
    .filter((g) => g.miles <= 75)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, 6);
}

export type Hydro = { t: string; v: number }[];

/** One gauge's last 3 days observed and its official forecast (NWPS). */
export async function hydrograph(
  id: string,
): Promise<{ observed: Hydro; forecast: Hydro; units: string }> {
  const r = await fetch(
    `https://api.water.noaa.gov/nwps/v1/gauges/${id}/stageflow`,
    {
      headers: UA,
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error(`stageflow ${r.status}`);
  type Series = {
    data?: { validTime: string; primary: number }[];
    primaryUnits?: string;
  };
  const j = (await r.json()) as { observed?: Series; forecast?: Series };
  const since = Date.now() - 72 * 3600000;
  const pts = (s?: Series) =>
    (s?.data ?? [])
      .filter((d) => d.primary > -999)
      .map((d) => ({ t: d.validTime, v: Math.round(d.primary * 100) / 100 }));
  return {
    observed: pts(j.observed).filter((p) => Date.parse(p.t) >= since),
    forecast: pts(j.forecast),
    units: j.observed?.primaryUnits ?? "ft",
  };
}
