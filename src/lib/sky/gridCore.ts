import { sunPosition } from "./astro";
import { bestPair, skyScore, type SkyHour } from "./score";

/**
 * The national stargazing grid, pure: a 2.5° × 3° lattice over the Lower 48 (and the waters
 * around it, so coasts interpolate honestly), scored every hour for the next 60 hours, with
 * each point's best two dark hours tonight and tomorrow night. Used by the server route and,
 * when Open-Meteo refuses the server's shared address, by the viewer's own browser.
 */
export const LATS = Array.from({ length: 11 }, (_, i) => 24.5 + i * 2.5);
export const LONS = Array.from({ length: 20 }, (_, i) => -124.5 + i * 3);
export const VARS = [
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "relative_humidity_2m",
  "precipitation",
  "visibility",
] as const;

export type Hourly = Record<(typeof VARS)[number], (number | null)[]> & {
  time: string[];
};
export type SkyGrid = {
  lats: number[];
  lons: number[];
  t0: string;
  scores: number[][];
  tonight: (number | null)[];
  tomorrow: (number | null)[];
};

/** Open-Meteo's hourly sky inputs for one or many points (UTC hours), 3 days. */
export const skyUrl = (lats: number[], lons: number[]) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&hourly=${VARS.join(",")}&forecast_days=3&timezone=GMT`;

/** An Open-Meteo hour ("2026-11-26T08:00", UTC) as a Date; tolerant of seconds or a zone. */
export const hourAt = (t: string) =>
  new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t.length === 16 ? `${t}:00` : t}Z`,
  );

/**
 * Whether a forecast still reaches well into the future. A cached copy that has run out
 * (every hour already past) is what left the page blank and the hours "Invalid Date".
 */
export function fresh(h: Hourly | undefined, now = Date.now()) {
  const last = h?.time?.at(-1);
  return !!last && hourAt(last).getTime() >= now + 18 * 3600_000;
}

/** Parse Open-Meteo's answer (one point or many) into one Hourly per point. */
export function hourlies(raw: unknown): Hourly[] {
  return ((Array.isArray(raw) ? raw : [raw]) as { hourly: Hourly }[]).map(
    (x) => x.hourly,
  );
}

/** Score every hour of one point's forecast from `from` on. */
export function scoreHours(h: Hourly, lat: number, lon: number, from: number) {
  const out: SkyHour[] = [];
  h.time.forEach((t, i) => {
    const at = hourAt(t);
    if (!(at.getTime() >= from)) return;
    out.push({
      at,
      score: skyScore({
        at,
        lat,
        lon,
        cloud: h.cloud_cover[i] ?? 50,
        low: h.cloud_cover_low[i],
        mid: h.cloud_cover_mid[i],
        high: h.cloud_cover_high[i],
        rh: h.relative_humidity_2m[i] ?? 60,
        precip: h.precipitation[i] ?? 0,
        vis: h.visibility[i],
      }).score,
    });
  });
  return out;
}

/** Splits hours into nights (runs of hours with the sun below −12°). */
export function nights(hours: SkyHour[], lat: number, lon: number) {
  const dark = (at: Date) => sunPosition(at, lat, lon).altitude < -12;
  const out: SkyHour[][] = [];
  let run: SkyHour[] = [];
  for (const h of hours) {
    if (dark(h.at)) run.push(h);
    else if (run.length) {
      out.push(run);
      run = [];
    }
  }
  if (run.length) out.push(run);
  return { list: out, dark };
}

/** The grid from one Hourly per lattice point (LATS × LONS, row by row). */
export function buildGrid(data: Hourly[], now = Date.now()): SkyGrid {
  const pts = LATS.flatMap((lat) => LONS.map((lon) => [lat, lon] as const));
  const from = Math.floor(now / 3600_000) * 3600_000;
  let t0 = "";
  const scores: number[][] = [];
  const tonight: (number | null)[] = [];
  const tomorrow: (number | null)[] = [];
  pts.forEach(([lat, lon], i) => {
    const hours = data[i]
      ? scoreHours(data[i], lat, lon, from).slice(0, 60)
      : [];
    t0 ||= hours[0]?.at.toISOString() ?? "";
    scores.push(hours.map((h) => h.score));
    const { list, dark } = nights(hours, lat, lon);
    // "Tonight" is the night in progress (after midnight) or the next one.
    tonight.push(list[0] ? (bestPair(list[0], dark)?.score ?? null) : null);
    tomorrow.push(list[1] ? (bestPair(list[1], dark)?.score ?? null) : null);
  });
  return { lats: LATS, lons: LONS, t0, scores, tonight, tomorrow };
}

/** The grid's points, for one multi-point Open-Meteo request. */
export const gridPoints = () => {
  const pts = LATS.flatMap((lat) => LONS.map((lon) => [lat, lon] as const));
  return { lats: pts.map((p) => p[0]), lons: pts.map((p) => p[1]) };
};
