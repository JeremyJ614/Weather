import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gridSize, locator } from "@/lib/models/grib2";
import { MODELS, latestCycle, record } from "@/lib/models/render";
import { supabaseAdmin } from "@/lib/supabase/admin";
import meta from "./meta.json";

/**
 * Severe Analogs (Extras engine), after Saint Louis University's CIPS analogs: today's and
 * tomorrow's weather from the GFS, as daily means on the same 2.5° grid as the archive
 * (scripts/build-analogs.py), is compared with every past day within six weeks of the same
 * date since 2004. The closest 15 say how severe days like this usually turn out.
 */
const N = 15;
const SEASON = 45;
const GFS: Record<string, string> = {
  z500: ":HGT:500 mb:",
  t850: ":TMP:850 mb:",
  u850: ":UGRD:850 mb:",
  v850: ":VGRD:850 mb:",
  u500: ":UGRD:500 mb:",
  v500: ":VGRD:500 mb:",
  pwat: ":PWAT:entire atmosphere (considered as a single layer):",
  li: ":4LFTX:surface:",
};

type Archive = {
  mean: Float32Array;
  std: Float32Array;
  w: Float32Array;
  basis: Float32Array;
  scale: Float32Array;
  pcs: Int16Array;
  tally: Uint16Array;
};
let archive: Promise<Archive> | null = null;

/** The archive file, from the site itself (or the disk when running locally). */
export function loadArchive(origin?: string) {
  archive ??= (async () => {
    let buf: ArrayBuffer | null = null;
    if (origin)
      buf = await fetch(new URL("/extras/analogs.bin", origin), {
        cache: "force-cache",
        signal: AbortSignal.timeout(20000),
      })
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
    if (!buf) {
      const b = await readFile(
        join(process.cwd(), "public/extras/analogs.bin"),
      );
      buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    const { f: F, k: K, days: D } = meta;
    let o = 0;
    const f32 = (n: number) => {
      const a = new Float32Array(buf!.slice(o, o + n * 4));
      o += n * 4;
      return a;
    };
    const mean = f32(F);
    const std = f32(F);
    const w = f32(F);
    const basis = f32(K * F);
    const scale = f32(K);
    const pcs = new Int16Array(buf.slice(o, o + D * K * 2));
    o += D * K * 2;
    const tally = new Uint16Array(buf.slice(o, o + D * 4));
    return { mean, std, w, basis, scale, pcs, tally };
  })().catch((e) => {
    archive = null;
    throw e;
  });
  return archive;
}

const cycleTime = (c: string) =>
  Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8));
const ymdh = (t: number) =>
  new Date(t).toISOString().slice(0, 13).replace(/[-T]/g, "");

/** A UTC day's mean weather on the archive's grid, from the GFS (analyses for past hours). */
export async function dayFeatures(day: number, cycle: string) {
  const c0 = cycleTime(cycle);
  const sum = new Float64Array(meta.f);
  const times = [0, 6, 12, 18].map((h) => day + h * 3600_000);
  for (const t of times) {
    const [run, fh] =
      t >= c0 ? [cycle, Math.round((t - c0) / 3600_000)] : [ymdh(t), 0];
    const url = MODELS.gfs.url(run.slice(0, 8), run.slice(8), fh);
    const recs = await Promise.all(
      meta.fields.map((name) => record(url, GFS[name])),
    );
    let k = 0;
    recs.forEach((r) => {
      const loc = locator(r.grid);
      const [w] = gridSize(r.grid);
      for (const lat of meta.lats)
        for (const lon of meta.lons) {
          const [fi, fj] = loc(lat, lon);
          sum[k++] += r.values[Math.round(fj) * w + Math.round(fi)];
        }
    });
  }
  return Array.from(sum, (v) => v / times.length);
}

const dayOfYear = (t: number) => {
  const d = new Date(t);
  return Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400_000);
};

export type Analog = { day: string; dist: number; n: number; torn: number };

/** The archive's closest days to a feature vector, within six weeks of the same date. */
export function closest(a: Archive, x: number[], day: number, n = N): Analog[] {
  const { f: F, k: K, days: D } = meta;
  const pc = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    let s = 0;
    for (let i = 0; i < F; i++)
      s += ((x[i] - a.mean[i]) / a.std[i]) * a.w[i] * a.basis[k * F + i];
    pc[k] = s;
  }
  const start = Date.parse(`${meta.start}T00:00:00Z`);
  const doy = dayOfYear(day);
  const out: Analog[] = [];
  for (let d = 0; d < D; d++) {
    const t = start + d * 86400_000;
    const gap = Math.abs(dayOfYear(t) - doy);
    if (Math.min(gap, 365 - gap) > SEASON) continue;
    let s = 0;
    for (let k = 0; k < K; k++) {
      const v = a.pcs[d * K + k] * a.scale[k] - pc[k];
      s += v * v;
    }
    out.push({
      day: new Date(t).toISOString().slice(0, 10),
      dist: Math.sqrt(s),
      n: a.tally[d * 2],
      torn: a.tally[d * 2 + 1],
    });
  }
  return out.sort((p, q) => p.dist - q.dist).slice(0, n);
}

/** Chances of 10+, 25+ and 50+ reports and the average tornadoes among the analogs. */
export function chances(list: Analog[]) {
  const share = (m: number) =>
    list.length ? list.filter((x) => x.n >= m).length / list.length : 0;
  return {
    p10: share(10),
    p25: share(25),
    p50: share(50),
    torn: list.length
      ? Math.round((list.reduce((s, x) => s + x.torn, 0) / list.length) * 10) /
        10
      : 0,
  };
}

/** SPC's report file for one day: every tornado, wind and hail report's place. */
export async function dayReports(day: string) {
  const y = day.slice(2, 4) + day.slice(5, 7) + day.slice(8, 10);
  const r = await fetch(
    `https://www.spc.noaa.gov/climo/reports/${y}_rpts.csv`,
    {
      // A finished day's file doesn't change.
      next: {
        revalidate:
          day < new Date().toISOString().slice(0, 8) ? 30 * 86400 : 3600,
      },
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => null);
  if (!r?.ok) return null;
  const out: {
    kind: "torn" | "wind" | "hail";
    lat: number;
    lon: number;
    mag: number;
  }[] = [];
  let kind: "torn" | "wind" | "hail" = "torn";
  for (const line of (await r.text()).split("\n")) {
    if (line.startsWith("Time,F_Scale")) kind = "torn";
    else if (line.startsWith("Time,Speed")) kind = "wind";
    else if (line.startsWith("Time,Size")) kind = "hail";
    else {
      const c = line.split(",");
      const lat = Number(c[5]);
      const lon = Number(c[6]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !lat) continue;
      out.push({ kind, lat, lon, mag: Number(c[1]) || 0 });
    }
  }
  return out;
}

/** Severe by the archive's rules: tornadoes, 1" hail (100 = 1.00"), 50 kt or damage. */
export const severeCount = (r: { kind: string; mag: number }[]) =>
  r.filter(
    (x) =>
      x.kind === "torn" ||
      (x.kind === "hail" && x.mag >= 100) ||
      (x.kind === "wind" && (x.mag === 0 || x.mag >= 58)),
  ).length;

/**
 * Four times a day (pg_cron "engine-analogs"): match today and tomorrow from the newest GFS
 * run, and score the days that have finished.
 */
export async function runAnalogs(origin?: string) {
  const [a, cycle] = await Promise.all([
    loadArchive(origin),
    latestCycle("gfs"),
  ]);
  if (!cycle) throw new Error("No GFS run is available");
  const today = Math.floor(Date.now() / 86400_000) * 86400_000;
  const db = supabaseAdmin();
  const made: string[] = [];
  for (const day of [today, today + 86400_000]) {
    const x = await dayFeatures(day, cycle);
    const list = closest(a, x, day);
    const c = chances(list);
    const { error } = await db.from("analog_days").upsert({
      day: new Date(day).toISOString().slice(0, 10),
      made_at: new Date().toISOString(),
      cycle,
      ...c,
      analogs: list.map((l) => ({ ...l, dist: Math.round(l.dist * 10) / 10 })),
    });
    if (error) throw new Error(error.message);
    made.push(new Date(day).toISOString().slice(0, 10));
  }
  // Score finished days (SPC's file is complete by the next morning).
  const { data: open } = await db
    .from("analog_days")
    .select("day")
    .is("actual", null)
    .lt("day", new Date(today - 86400_000 + 1).toISOString().slice(0, 10))
    .limit(10);
  for (const r of open ?? []) {
    const rep = await dayReports(r.day as string);
    if (rep)
      await db
        .from("analog_days")
        .update({
          actual: severeCount(rep),
          checked_at: new Date().toISOString(),
        })
        .eq("day", r.day);
  }
  await db
    .from("analog_days")
    .delete()
    .lt("day", new Date(today - 731 * 86400_000).toISOString().slice(0, 10));
  return { cycle, made, scored: open?.length ?? 0 };
}

/** How the engine did over the last `days`: reliability of its 10+ report chance. */
export async function analogScore(days = 90) {
  const { data } = await supabaseAdmin()
    .from("analog_days")
    .select("p10, actual")
    .not("actual", "is", null)
    .gt(
      "day",
      new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10),
    );
  const rows = data ?? [];
  const bin = (lo: number, hi: number) => {
    const r = rows.filter((x) => x.p10 >= lo && x.p10 < hi);
    return {
      n: r.length,
      hit: r.filter((x) => (x.actual as number) >= 10).length,
    };
  };
  const brier = rows.length
    ? rows.reduce(
        (s, x) => s + (x.p10 - ((x.actual as number) >= 10 ? 1 : 0)) ** 2,
        0,
      ) / rows.length
    : null;
  return {
    days,
    scored: rows.length,
    brier: brier == null ? null : Math.round(brier * 1000) / 1000,
    low: bin(0, 0.2),
    mid: bin(0.2, 0.5),
    high: bin(0.5, 1.01),
  };
}

const MAP = { W: -125, E: -66, S: 24, N: 50, step: 0.25 };

/**
 * The analogs' own outlook: the share of the 15 matched days that had a severe report within
 * 40 km (25 miles) of each spot, drawn as nested areas like SPC's.
 */
export async function analogAreas(list: Analog[], levels: number[]) {
  const { latticeAreas, soften } = await import("@/lib/engines/areas");
  const w = Math.round((MAP.E - MAP.W) / MAP.step) + 1;
  const h = Math.round((MAP.N - MAP.S) / MAP.step) + 1;
  const share = new Float32Array(w * h);
  const days = await Promise.all(list.map((a) => dayReports(a.day)));
  const used = days.filter(Boolean).length;
  const R = 2; // cells: 0.5° ≈ 40 km
  for (const reps of days) {
    if (!reps) continue;
    const hit = new Uint8Array(w * h);
    for (const r of reps) {
      const ci = Math.round((r.lon - MAP.W) / MAP.step);
      const cj = Math.round((MAP.N - r.lat) / MAP.step);
      for (let j = cj - R; j <= cj + R; j++)
        for (let i = ci - R; i <= ci + R; i++)
          if (i >= 0 && j >= 0 && i < w && j < h) hit[j * w + i] = 1;
    }
    for (let k = 0; k < hit.length; k++) share[k] += hit[k];
  }
  if (used)
    for (let k = 0; k < share.length; k++) share[k] = (100 * share[k]) / used;
  return {
    used,
    areas: latticeAreas(
      soften(share, w, h, 1),
      w,
      h,
      MAP.W,
      MAP.N,
      MAP.step,
      levels,
    ),
  };
}
