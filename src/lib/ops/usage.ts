import "server-only";
import { readJson, writeJson, listNames, removeFiles } from "./store";

/**
 * Usage meter (post-launch A1 "cost-guard"): each server instance counts the data-route and
 * scheduled-job calls it handles and the CPU time it spends, and every few minutes saves its
 * running totals for the day to `ops/usage/<day>/<instance>.json`. Admin → System health adds
 * them up and projects the month against the Hobby plan's allowances. Page views the CDN
 * answers never reach us, so they cost nothing and aren't counted.
 */
export type DayUsage = { calls: Record<string, number>; cpuMs: number };

const INSTANCE = Math.random().toString(36).slice(2, 10);
const FLUSH_MS = 5 * 60_000;
const FLUSH_CALLS = 50;

let day = new Date().toISOString().slice(0, 10);
let counts: Record<string, number> = {};
let cpuBase = process.cpuUsage();
let pending = 0;
let lastFlush = 0;
let saving: Promise<void> | null = null;

function snapshot(): DayUsage {
  const c = process.cpuUsage(cpuBase);
  return {
    calls: { ...counts },
    cpuMs: Math.round((c.user + c.system) / 1000),
  };
}

function save(d: string, u: DayUsage) {
  saving = writeJson(`usage/${d}/${INSTANCE}.json`, u)
    .catch(() => undefined)
    .finally(() => (saving = null));
  return saving;
}

/** Counts one call; saves now and then (never blocks the response it's counting). */
export function track(route: string, now = Date.now()) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) {
    // A new UTC day: close the old one and start fresh.
    void save(day, snapshot());
    day = d;
    counts = {};
    cpuBase = process.cpuUsage();
    pending = 0;
  }
  counts[route] = (counts[route] ?? 0) + 1;
  pending += 1;
  if (saving || (pending < FLUSH_CALLS && now - lastFlush < FLUSH_MS)) return;
  pending = 0;
  lastFlush = now;
  void save(day, snapshot());
}

/**
 * One day's totals. Finished days are folded into a single `total.json` the first time they
 * are read, and the per-instance files removed, so the meter stays small.
 */
async function dayTotal(d: string, today: string): Promise<DayUsage | null> {
  const names = await listNames(`usage/${d}`);
  if (!names.length) return null;
  if (names.includes("total.json") && names.length === 1)
    return readJson<DayUsage>(`usage/${d}/total.json`, { calls: {}, cpuMs: 0 });
  const parts = await Promise.all(
    names.map((n) =>
      readJson<DayUsage>(`usage/${d}/${n}`, { calls: {}, cpuMs: 0 }),
    ),
  );
  const sum: DayUsage = { calls: {}, cpuMs: 0 };
  for (const p of parts) {
    sum.cpuMs += p.cpuMs || 0;
    for (const [k, v] of Object.entries(p.calls ?? {}))
      sum.calls[k] = (sum.calls[k] ?? 0) + v;
  }
  if (d < today) {
    await writeJson(`usage/${d}/total.json`, sum).catch(() => undefined);
    await removeFiles(
      names.filter((n) => n !== "total.json").map((n) => `usage/${d}/${n}`),
    ).catch(() => undefined);
  }
  return sum;
}

/** Hobby plan allowances per month, as Vercel publishes them (Vercel → Usage is exact). */
export const HOBBY = { calls: 1_000_000, cpuHours: 4 };

/** The last `days` days, oldest first, and a 30-day projection from the last 7. */
export async function usageReport(days = 14, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  const list = Array.from({ length: days }, (_, i) =>
    new Date(now - (days - 1 - i) * 864e5).toISOString().slice(0, 10),
  );
  const totals = await Promise.all(
    list.map((d) => dayTotal(d, today).catch(() => null)),
  );
  const rows = list.map((d, i) => {
    const t = totals[i];
    const calls = t ? Object.values(t.calls).reduce((a, b) => a + b, 0) : 0;
    return { day: d, calls, cpuMs: t?.cpuMs ?? 0, byRoute: t?.calls ?? {} };
  });
  const recent = rows.filter((r) => r.day < today).slice(-7);
  const n = Math.max(1, recent.length);
  const callsMonth = Math.round(
    (recent.reduce((a, r) => a + r.calls, 0) / n) * 30,
  );
  const cpuMonthH =
    ((recent.reduce((a, r) => a + r.cpuMs, 0) / n) * 30) / 3.6e6;
  const top: Record<string, number> = {};
  for (const r of recent)
    for (const [k, v] of Object.entries(r.byRoute)) top[k] = (top[k] ?? 0) + v;
  return {
    rows,
    measuredDays: recent.filter((r) => r.calls > 0).length,
    callsMonth,
    cpuMonthH,
    callsPct: (100 * callsMonth) / HOBBY.calls,
    cpuPct: (100 * cpuMonthH) / HOBBY.cpuHours,
    top: Object.entries(top)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  };
}
