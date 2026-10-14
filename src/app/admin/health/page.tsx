import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: "System health · Admin · StormSync Media",
};

type Health = {
  db_bytes: number;
  members: number;
  errors_24h: number;
  tables: { name: string; rows: number; bytes: number }[] | null;
  caches: Record<string, string | null>;
  cron: {
    job: string;
    schedule: string;
    last: string | null;
    ok: boolean | null;
  }[];
};

const mb = (b: number) =>
  b >= 1e6
    ? `${(b / 1e6).toFixed(1)} MB`
    : `${Math.max(1, Math.round(b / 1e3))} kB`;
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60
    ? `${m} min ago`
    : m < 2880
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} days ago`;
};
const CACHES: Record<string, [string, number]> = {
  sswxcon: ["SSWXCON level", 90],
  weather_news: ["Weather news", 26 * 60],
  afd_simplified: ["Simplified discussions", 26 * 60],
  storage_snapshot: ["Storage snapshot", 26 * 60],
  daily_brief: ["Daily Brief sends", 26 * 60],
};
const DB_LIMIT = 500e6;
const now = () => Date.now();

/** Database size, biggest tables, cache ages and scheduled jobs (VIP #44). */
export default async function HealthPage() {
  const { supabase } = await requireAdmin("health");
  const { data, error } = await supabase.rpc("admin_health");
  const h = data as Health | null;
  if (error || !h)
    return (
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">
        <h1 className="display text-3xl text-accent">System health</h1>
        <p className="mt-4 text-muted">
          Health couldn&apos;t be read right now. Reload to try again.
        </p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">System health</h1>
      <div className="grid grid-cols-3 gap-2">
        {[
          [
            "Database",
            mb(h.db_bytes),
            `${Math.round((h.db_bytes / DB_LIMIT) * 100)}% of free 500 MB`,
          ],
          ["Members", String(h.members), "profiles"],
          ["Errors", String(h.errors_24h), "groups seen in 24 h"],
        ].map(([k, v, sub]) => (
          <div
            key={k}
            className="grid gap-0.5 rounded-2xl border border-line bg-surface p-3"
          >
            <span className="text-xs text-muted">{k}</span>
            <b className="mono text-xl text-accent">{v}</b>
            <span className="text-[11px] text-muted">{sub}</span>
          </div>
        ))}
      </div>
      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Caches</h2>
        {Object.entries(CACHES).map(([k, [label, maxMin]]) => {
          const at = h.caches[k];
          const stale = !at || now() - Date.parse(at) > maxMin * 60000;
          return (
            <p key={k} className="flex justify-between gap-3 text-sm">
              <span>{label}</span>
              <span className={stale ? "text-[#fbbf24]" : "text-muted"}>
                {ago(at)}
                {stale && " · stale"}
              </span>
            </p>
          );
        })}
      </section>
      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Scheduled jobs</h2>
        {h.cron.map((j) => (
          <p key={j.job} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {j.job}{" "}
              <span className="mono text-xs text-muted">{j.schedule}</span>
            </span>
            <span className={j.ok === false ? "text-[#f87171]" : "text-muted"}>
              {j.ok === false ? "failed · " : ""}
              {ago(j.last)}
            </span>
          </p>
        ))}
      </section>
      <section className="grid gap-1 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">Tables</h2>
        {(h.tables ?? []).slice(0, 25).map((t) => (
          <p
            key={t.name}
            className="flex justify-between gap-3 text-sm tabular-nums"
          >
            <span className="mono min-w-0 truncate text-xs">{t.name}</span>
            <span className="text-muted">
              {t.rows.toLocaleString("en-US")} rows · {mb(t.bytes)}
            </span>
          </p>
        ))}
      </section>
    </main>
  );
}
