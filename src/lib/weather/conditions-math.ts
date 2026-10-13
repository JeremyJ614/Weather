/** Pure helpers for current conditions; tested alone. */
export type Ring = [number, number][];

/** Ray casting; coordinates are [lon, lat]. */
export function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}

type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export function inGeometry(lon: number, lat: number, g: Geometry): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(
    ([outer, ...holes]) =>
      inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)),
  );
}

export const SPC_LEVELS = [
  "TSTM",
  "MRGL",
  "SLGT",
  "ENH",
  "MDT",
  "HIGH",
] as const;
export const SPC_NAMES: Record<string, string> = {
  TSTM: "General thunderstorms",
  MRGL: "Marginal (1 of 5)",
  SLGT: "Slight (2 of 5)",
  ENH: "Enhanced (3 of 5)",
  MDT: "Moderate (4 of 5)",
  HIGH: "High (5 of 5)",
};

/** Highest SPC category whose area contains the point, or null. */
export function spcAt(
  lon: number,
  lat: number,
  features: { properties: { LABEL: string }; geometry: Geometry }[],
) {
  let best = -1;
  for (const f of features) {
    const i = SPC_LEVELS.indexOf(
      f.properties.LABEL as (typeof SPC_LEVELS)[number],
    );
    if (i > best && f.geometry && inGeometry(lon, lat, f.geometry)) best = i;
  }
  return best < 0 ? null : SPC_LEVELS[best];
}

export type Trend = "rising" | "falling" | "steady";

/** Pressure change over about 3 hours, from newest-first readings (hPa). */
export function pressureTrend(
  readings: { at: string; hpa: number | null }[],
): { trend: Trend; change: number } | null {
  const valid = readings.filter(
    (r): r is { at: string; hpa: number } => r.hpa != null,
  );
  if (valid.length < 2) return null;
  const now = valid[0];
  const t0 = Date.parse(now.at);
  const past = valid.find((r) => t0 - Date.parse(r.at) >= 2.5 * 3600000);
  if (!past) return null;
  const change = Math.round((now.hpa - past.hpa) * 10) / 10;
  return {
    trend: change >= 1 ? "rising" : change <= -1 ? "falling" : "steady",
    change,
  };
}

/** EPA UV rows ("Oct/13/2026 06 AM") → the value for the current local hour and the day's max. */
export function uvNow(
  rows: { DATE_TIME: string; UV_VALUE: number }[],
  localHour: number,
) {
  if (!rows.length) return null;
  const hourOf = (s: string) => {
    const m = /(\d{2}) (AM|PM)$/.exec(s);
    if (!m) return -1;
    const h = Number(m[1]) % 12;
    return m[2] === "PM" ? h + 12 : h;
  };
  const cur = rows.find((r) => hourOf(r.DATE_TIME) === localHour);
  return {
    now: cur?.UV_VALUE ?? 0,
    max: Math.max(...rows.map((r) => r.UV_VALUE)),
  };
}

export const uvLabel = (v: number) =>
  v < 3
    ? "Low"
    : v < 6
      ? "Moderate"
      : v < 8
        ? "High"
        : v < 11
          ? "Very high"
          : "Extreme";
