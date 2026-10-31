import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  Bars,
  Banner,
  Card,
  Chips,
  Meter,
  Note,
  Page,
  Row,
  Rows,
  Tile,
  Tiles,
  TONE,
} from "@/components/admin/Dash";

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

/**
 * Database size, biggest tables, cache ages and scheduled jobs (VIP #44), led by a verdict
 * and sorted so anything wrong is on top (owner's follow-up #5).
 */
export default async function HealthPage() {
  const { supabase } = await requireAdmin("health");
  const { data, error } = await supabase.rpc("admin_health");
  const h = data as Health | null;
  if (error || !h)
    return (
      <Page title="System health">
        <Banner
          color={TONE.bad}
          title="Health couldn't be read right now"
          detail="Reload to try again."
        />
      </Page>
    );
  const dbF = h.db_bytes / DB_LIMIT;
  const caches = Object.entries(CACHES).map(([k, [label, maxMin]]) => {
    const at = h.caches[k];
    const age = at ? (now() - Date.parse(at)) / 60000 : Infinity;
    return { label, at, f: Math.min(1, age / maxMin), stale: age > maxMin };
  });
  const stale = caches.filter((c) => c.stale);
  const failed = h.cron.filter((j) => j.ok === false);
  const issues =
    stale.length +
    failed.length +
    (dbF > 0.8 ? 1 : 0) +
    (h.errors_24h > 10 ? 1 : 0);
  const verdict =
    failed.length || dbF > 0.9 ? TONE.bad : issues ? TONE.warn : TONE.good;
  const tables = (h.tables ?? []).slice(0, 12);
  return (
    <Page
      title="System health"
      lead="Database room, how fresh each cached feed is, and every scheduled job, worst first."
    >
      <Banner
        color={verdict}
        title={
          issues
            ? `${issues} ${issues === 1 ? "thing needs" : "things need"} a look`
            : "All systems normal"
        }
        detail={[
          failed.length
            ? `${failed.length} failed ${failed.length === 1 ? "job" : "jobs"}`
            : null,
          stale.length
            ? `${stale.length} stale ${stale.length === 1 ? "cache" : "caches"}`
            : null,
          `${h.errors_24h} error groups in 24 h`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <Tiles>
        <Tile
          hero
          label="Database"
          value={mb(h.db_bytes)}
          sub={`${Math.round(dbF * 100)}% of the free 500 MB`}
          color={dbF > 0.8 ? TONE.warn : TONE.good}
        />
        <Tile
          label="Members"
          value={h.members.toLocaleString("en-US")}
          sub="profiles"
          color={TONE.info}
        />
        <Tile
          label="Errors"
          value={h.errors_24h}
          sub="groups seen in 24 h"
          color={h.errors_24h > 10 ? TONE.bad : TONE.violet}
        />
        <Tile
          label="Jobs"
          value={`${h.cron.length - failed.length}/${h.cron.length}`}
          sub="last run fine"
          color={failed.length ? TONE.bad : TONE.good}
        />
      </Tiles>
      <Card title="Database room" meta={`${mb(DB_LIMIT - h.db_bytes)} left`}>
        <Meter f={dbF} color={dbF > 0.8 ? TONE.warn : TONE.good} />
      </Card>
      <Card title="Caches" meta="bar = age against its limit">
        <Rows>
          {[...caches]
            .sort((a, b) => b.f - a.f)
            .map((c) => (
              <div key={c.label} style={{ display: "grid", gap: 4 }}>
                <Row
                  color={c.stale ? TONE.warn : TONE.good}
                  name={c.label}
                  detail={`${ago(c.at)}${c.stale ? " · stale" : ""}`}
                />
                <Meter f={c.f} color={c.stale ? TONE.warn : TONE.good} />
              </div>
            ))}
        </Rows>
      </Card>
      <Card title="Scheduled jobs" meta={`${h.cron.length} jobs`}>
        <Chips>
          {[...h.cron]
            .sort((a, b) => Number(a.ok !== false) - Number(b.ok !== false))
            .map((j) => (
              <Row
                key={j.job}
                color={
                  j.ok === false ? TONE.bad : j.last ? TONE.good : TONE.warn
                }
                name={j.job}
                detail={
                  j.ok === false ? `failed · ${ago(j.last)}` : ago(j.last)
                }
              />
            ))}
        </Chips>
      </Card>
      <Card title="Biggest tables" meta="by size">
        <Bars
          rows={tables.map((t) => ({
            label: <span className="mono text-xs">{t.name}</span>,
            value: t.bytes,
            text: `${t.rows.toLocaleString("en-US")} rows · ${mb(t.bytes)}`,
            color: TONE.info,
          }))}
        />
      </Card>
      <Note>
        Schedules run in the database (pg_cron) and on Vercel. A stale cache
        refills on its next visit or run.
      </Note>
    </Page>
  );
}
