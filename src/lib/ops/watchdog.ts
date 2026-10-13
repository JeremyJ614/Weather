/**
 * Storage watchdog rules (docs/06-STORAGE-SAFETY.md, rule 5). Pure, so they are tested alone;
 * the cron route does the reading, recording and emailing.
 */

/** Supabase free plan quotas. Raise these when the plan changes. */
export const QUOTA = { dbBytes: 500 * 1024 ** 2, storageBytes: 1024 ** 3 };

export type Level = "ok" | "warn" | "critical";
const RANK: Record<Level, number> = { ok: 0, warn: 1, critical: 2 };

export function assess(dbBytes: number, storageBytes: number) {
  const dbPct = dbBytes / QUOTA.dbBytes;
  const storagePct = storageBytes / QUOTA.storageBytes;
  const worst = Math.max(dbPct, storagePct);
  const level: Level = worst >= 0.8 ? "critical" : worst >= 0.6 ? "warn" : "ok";
  return { level, dbPct, storagePct };
}

export type LastAlert = { month: string; level: Level } | null;

/** Email once per level per month, and again only if things get worse. */
export function shouldAlert(
  last: LastAlert,
  level: Level,
  month: string,
): boolean {
  if (level === "ok") return false;
  if (!last || last.month !== month) return true;
  return RANK[level] > RANK[last.level];
}

export function utcMonth(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}
