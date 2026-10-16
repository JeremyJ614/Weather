import "server-only";
import { sunPosition } from "./astro";
import { bestPair, skyScore, type SkyHour } from "./score";

/**
 * The national stargazing grid: a 2.5° × 3° lattice over the Lower 48 (and the waters
 * around it, so coasts interpolate honestly), scored every hour for the next 60 hours,
 * and each point's best two dark hours tonight and tomorrow night. One Open-Meteo request
 * every 3 hours serves everyone.
 */
export const LATS = Array.from({ length: 11 }, (_, i) => 24.5 + i * 2.5);
export const LONS = Array.from({ length: 20 }, (_, i) => -124.5 + i * 3);
const VARS = [
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

/** Hourly sky inputs for one or many points (UTC hours), 3 days. */
export async function skyHourly(
  lats: number[],
  lons: number[],
  revalidate: number,
): Promise<Hourly[]> {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&hourly=${VARS.join(",")}&forecast_days=3&timezone=GMT`,
    { next: { revalidate }, signal: AbortSignal.timeout(30000) },
  );
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const raw = (await r.json()) as unknown;
  return ((Array.isArray(raw) ? raw : [raw]) as { hourly: Hourly }[]).map(
    (x) => x.hourly,
  );
}

/** Score every hour of one point's forecast from `from` on. */
export function scoreHours(h: Hourly, lat: number, lon: number, from: number) {
  const out: SkyHour[] = [];
  h.time.forEach((t, i) => {
    const at = new Date(`${t}:00Z`);
    if (at.getTime() < from) return;
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

export async function skyGrid(now = Date.now()) {
  const pts = LATS.flatMap((lat) => LONS.map((lon) => [lat, lon] as const));
  const data = await skyHourly(
    pts.map((p) => p[0]),
    pts.map((p) => p[1]),
    10800,
  );
  const from = Math.floor(now / 3600_000) * 3600_000;
  let t0 = "";
  const scores: number[][] = [];
  const tonight: (number | null)[] = [];
  const tomorrow: (number | null)[] = [];
  pts.forEach(([lat, lon], i) => {
    const hours = scoreHours(data[i], lat, lon, from).slice(0, 60);
    t0 ||= hours[0]?.at.toISOString() ?? "";
    scores.push(hours.map((h) => h.score));
    const { list, dark } = nights(hours, lat, lon);
    tonight.push(list[0] ? (bestPair(list[0], dark)?.score ?? null) : null);
    tomorrow.push(list[1] ? (bestPair(list[1], dark)?.score ?? null) : null);
  });
  return { lats: LATS, lons: LONS, t0, scores, tonight, tomorrow };
}
