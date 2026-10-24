import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Hourly (pg_cron "engine-verify"): each engine flag old enough for the storm reports to be
 * in (3 hours) is checked against them: a hit when a qualifying report came inside the flag's
 * window and radius. Rows past 120 days are pruned.
 */
type Report = {
  t: number;
  type: string;
  mag: number;
  lat: number;
  lon: number;
};
const stamp = (t: number) =>
  new Date(t).toISOString().slice(0, 16).replace(/[-:T]/g, "");

/** IEM Local Storm Reports between two times. */
export async function reportsBetween(from: number, to: number) {
  const r = await fetch(
    `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${stamp(from)}&ets=${stamp(to)}&fmt=geojson`,
    { cache: "no-store", signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw new Error(`IEM ${r.status}`);
  const d = (await r.json()) as {
    features?: {
      properties?: { valid?: string; typetext?: string; magnitude?: string };
      geometry?: { coordinates?: [number, number] };
    }[];
  };
  return (d.features ?? []).flatMap((f): Report[] => {
    const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
    const t = Date.parse(f.properties?.valid ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(t)) return [];
    return [
      {
        t,
        type: (f.properties?.typetext ?? "").trim().toUpperCase(),
        mag: Number(f.properties?.magnitude) || 0,
        lat,
        lon,
      },
    ];
  });
}

/** Severe by the Weather Service's definition: a tornado, 1" hail, 58 mph or wind damage. */
export const isSevere = (r: Report) =>
  r.type === "TORNADO" ||
  (r.type === "HAIL" && r.mag >= 1) ||
  (r.type === "TSTM WND GST" && r.mag >= 58) ||
  r.type === "TSTM WND DMG";

const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const x =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

type Check = {
  id: number;
  engine: string;
  at: string;
  lat: number;
  lon: number;
  window_min: number;
  radius_km: number;
};

/** Which reports count for each engine's flags. */
const COUNTS: Record<string, (r: Report) => boolean> = {
  surge: isSevere,
};

export function judge(c: Check, reports: Report[]) {
  const a = Date.parse(c.at);
  const ok = COUNTS[c.engine] ?? isSevere;
  return reports.some(
    (r) =>
      r.t >= a &&
      r.t <= a + c.window_min * 60_000 &&
      ok(r) &&
      km(c.lat, c.lon, r.lat, r.lon) <= c.radius_km,
  );
}

export async function verifyChecks() {
  const db = supabaseAdmin();
  const ready = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data, error } = await db
    .from("engine_checks")
    .select("id, engine, at, lat, lon, window_min, radius_km")
    .is("hit", null)
    .in("engine", Object.keys(COUNTS))
    .lt("at", ready)
    .order("at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Check[];
  let hits = 0;
  if (rows.length) {
    const from = Date.parse(rows[0].at);
    const to = Math.max(
      ...rows.map((r) => Date.parse(r.at) + r.window_min * 60_000),
    );
    const reports = await reportsBetween(from, to);
    const yes = rows.filter((r) => judge(r, reports)).map((r) => r.id);
    const no = rows.map((r) => r.id).filter((id) => !yes.includes(id));
    hits = yes.length;
    const now = new Date().toISOString();
    for (const [ids, hit] of [
      [yes, true],
      [no, false],
    ] as const)
      for (let i = 0; i < ids.length; i += 200)
        await db
          .from("engine_checks")
          .update({ hit, checked_at: now })
          .in("id", ids.slice(i, i + 200));
  }
  await db
    .from("engine_checks")
    .delete()
    .lt("at", new Date(Date.now() - 120 * 86400_000).toISOString());
  return { checked: rows.length, hits };
}
