import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { file, fileNames, stamp as psStamp } from "./probsevere";

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

/** A place an engine flagged, to be checked against what happened. */
export type Flag = {
  key: string;
  at: number;
  lat: number;
  lon: number;
  label: string;
  window_min: number;
  radius_km: number;
};

/** Saves an engine's flags (each key once). */
export async function logFlags(engine: string, flags: Flag[]) {
  if (!flags.length) return 0;
  const { error } = await supabaseAdmin()
    .from("engine_checks")
    .upsert(
      flags.map((f) => ({
        engine,
        key: f.key.slice(0, 80),
        at: new Date(f.at).toISOString(),
        lat: f.lat,
        lon: f.lon,
        label: f.label.slice(0, 120),
        window_min: f.window_min,
        radius_km: f.radius_km,
      })),
      { onConflict: "engine,key", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  return flags.length;
}

/** Engine hit rate over the last `days`: flags checked, and how many the weather followed. */
export async function engineStats(engine: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const db = supabaseAdmin();
  const q = () =>
    db
      .from("engine_checks")
      .select("id", { count: "exact", head: true })
      .eq("engine", engine)
      .gt("at", since);
  const [all, hits] = await Promise.all([
    q().not("hit", "is", null),
    q().eq("hit", true),
  ]);
  return { days, checked: all.count ?? 0, hits: hits.count ?? 0 };
}

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
  blizz: (r) => r.type === "BLIZZARD" || r.type === "SNOW SQUALL",
};

/**
 * While a blizzard flag's window is open, an airport within its radius reporting a quarter
 * mile or less with 30 kt winds or gusts (in the last 90 minutes) makes it a hit.
 */
async function liveBlizzard() {
  const db = supabaseAdmin();
  const now = Date.now();
  const { data } = await db
    .from("engine_checks")
    .select("id, at, lat, lon, window_min, radius_km")
    .eq("engine", "blizz")
    .is("hit", null)
    .lte("at", new Date(now).toISOString())
    .gt("at", new Date(now - 13 * 3600_000).toISOString());
  const open = (data ?? []).filter(
    (r) => Date.parse(r.at) + r.window_min * 60_000 >= now,
  );
  if (!open.length) return 0;
  const r = await fetch(
    "https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&country=US",
    { cache: "no-store", signal: AbortSignal.timeout(30000) },
  ).catch(() => null);
  if (!r?.ok) return 0;
  const obs = (
    (await r.json()) as {
      data: {
        lat: number;
        lon: number;
        vsby: number | null;
        sknt: number | null;
        gust: number | null;
        utc_valid: string | null;
      }[];
    }
  ).data.filter(
    (o) =>
      o.vsby != null &&
      o.vsby <= 0.25 &&
      Math.max(o.gust ?? 0, o.sknt ?? 0) >= 30 &&
      o.utc_valid &&
      now - Date.parse(o.utc_valid) < 90 * 60_000,
  );
  const ids = open
    .filter((c) =>
      obs.some((o) => km(c.lat, c.lon, o.lat, o.lon) <= c.radius_km),
    )
    .map((c) => c.id);
  if (ids.length)
    await db
      .from("engine_checks")
      .update({ hit: true, checked_at: new Date().toISOString() })
      .in("id", ids);
  return ids.length;
}

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

/**
 * First Storms flags are checked against radar: a hit when any storm ProbSevere tracked (its
 * objects start at about 35 dBZ) sat within the radius during the window, sampled every 30
 * minutes from its ~25-hour file archive.
 */
async function radarFirst() {
  const db = supabaseAdmin();
  const now = Date.now();
  const { data } = await db
    .from("engine_checks")
    .select("id, at, lat, lon, window_min, radius_km")
    .eq("engine", "first")
    .is("hit", null)
    .gt("at", new Date(now - 22 * 3600_000).toISOString())
    .order("at", { ascending: true })
    .limit(300);
  const ready = (data ?? []).filter(
    (r) => Date.parse(r.at) + r.window_min * 60_000 < now - 15 * 60_000,
  );
  if (!ready.length) return 0;
  const names = await fileNames();
  const times = names.map(psStamp);
  const nearest = (t: number) => {
    let best = -1;
    for (let i = 0; i < times.length; i++)
      if (best < 0 || Math.abs(times[i] - t) < Math.abs(times[best] - t))
        best = i;
    return best >= 0 && Math.abs(times[best] - t) < 10 * 60_000 ? best : -1;
  };
  const want = new Map<number, number[]>();
  for (const r of ready) {
    const a = Date.parse(r.at);
    for (let t = a; t <= a + r.window_min * 60_000; t += 30 * 60_000) {
      const i = nearest(t);
      if (i >= 0) want.set(i, [...(want.get(i) ?? []), r.id]);
    }
  }
  const centers = new Map<number, [number, number][]>();
  for (const i of [...want.keys()].slice(0, 60)) {
    const raw = await file(names[i]).catch(() => null);
    if (raw)
      centers.set(
        i,
        raw.features.map((f) => [
          Number(f.properties.MLAT),
          Number(f.properties.MLON),
        ]),
      );
  }
  const hit = new Set<number>();
  for (const [i, ids] of want) {
    const pts = centers.get(i);
    if (!pts) continue;
    for (const id of ids) {
      const r = ready.find((x) => x.id === id)!;
      if (pts.some(([la, lo]) => km(r.lat, r.lon, la, lo) <= r.radius_km))
        hit.add(id);
    }
  }
  const at = new Date().toISOString();
  const yes = ready.filter((r) => hit.has(r.id)).map((r) => r.id);
  const no = ready.filter((r) => !hit.has(r.id)).map((r) => r.id);
  for (const [ids, h] of [
    [yes, true],
    [no, false],
  ] as const)
    for (let i = 0; i < ids.length; i += 200)
      await db
        .from("engine_checks")
        .update({ hit: h, checked_at: at })
        .in("id", ids.slice(i, i + 200));
  return ready.length;
}

export async function verifyChecks() {
  const db = supabaseAdmin();
  const live = await liveBlizzard().catch(() => 0);
  const radar = await radarFirst().catch(() => 0);
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
  // Reports lag: a flag is judged once its whole window ended at least 3 hours ago.
  const rows = ((data ?? []) as Check[]).filter(
    (r) => Date.parse(r.at) + r.window_min * 60_000 < Date.parse(ready),
  );
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
  return { checked: rows.length, hits, live, radar };
}
