import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * History rollover (review round, speed pick "rollover"): rows older than two years leave the
 * database for one gzipped JSON file per table and year in the private `history` bucket, so
 * the database stops growing with time and nothing is lost. Runs monthly from the storage
 * watchdog. Chase days were simply deleted after three years before this.
 *
 * Only tables read no further back than two years roll over: chase days (the Storm Chasing
 * Outlook's yearly view) and report days (Weather Patterns reads 400 days). The archive index
 * stays whole in the database: the Tornado Archive lists every event on each visit.
 */
export const ROLLED = ["chase_days", "report_days"] as const;
export const KEEP_DAYS = 730;
const BUCKET = "history";

type Row = { day: string } & Record<string, unknown>;

/** Rows grouped by calendar year. */
export function byYear(rows: Row[]) {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const y = r.day.slice(0, 4);
    out.set(y, [...(out.get(y) ?? []), r]);
  }
  return out;
}

/** A year's filed rows with new ones merged in (a newer copy of a day wins), oldest first. */
export function mergeYear(filed: Row[], rows: Row[]) {
  const m = new Map(filed.map((r) => [r.day, r]));
  for (const r of rows) m.set(r.day, r);
  return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function rollover(db: SupabaseClient, now = Date.now()) {
  const cutoff = new Date(now - KEEP_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  const moved: Record<string, number> = {};
  for (const table of ROLLED) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .lt("day", cutoff)
      .order("day")
      .limit(1000);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const [year, rows] of byYear((data ?? []) as Row[])) {
      const path = `${table}/${year}.json.gz`;
      const prev = await db.storage.from(BUCKET).download(path);
      const filed: Row[] = prev.data
        ? JSON.parse(
            gunzipSync(Buffer.from(await prev.data.arrayBuffer())).toString(),
          )
        : [];
      const up = await db.storage
        .from(BUCKET)
        .upload(path, gzipSync(JSON.stringify(mergeYear(filed, rows))), {
          upsert: true,
          contentType: "application/gzip",
        });
      // Rows leave the table only once their file is safely written.
      if (up.error) throw new Error(`${path}: ${up.error.message}`);
      const gone = await db
        .from(table)
        .delete()
        .in(
          "day",
          rows.map((r) => r.day),
        );
      if (gone.error) throw new Error(`${table}: ${gone.error.message}`);
      moved[path] = rows.length;
    }
  }
  return { cutoff, moved };
}
