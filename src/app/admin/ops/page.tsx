import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { checkFeeds } from "@/lib/ops/feeds";
import { MODULES } from "@/lib/ops/modules";
import { getSiteDefaults } from "@/lib/settings";
import { OpsForm } from "./OpsForm";
import {
  Bars,
  Banner,
  Card,
  Chips,
  Meter,
  Note,
  Page,
  Row,
  Tile,
  Tiles,
  TONE,
} from "@/components/admin/Dash";

export const metadata: Metadata = {
  title: "Live ops · Admin · StormSync Media",
};

type Counts = Record<string, number | string>;

export default async function Ops() {
  const { supabase } = await requireAdmin("ops");
  const [{ data: counts }, feeds, settings, { data: ai }] = await Promise.all([
    supabase.rpc("ops_counts"),
    checkFeeds(),
    getSiteDefaults(),
    supabase
      .from("ai_usage")
      .select("day, feature, calls, failures")
      .order("day", { ascending: false })
      .limit(30),
  ]);
  const c = (counts ?? {}) as Counts;
  const down = feeds.filter((f) => !f.ok);
  const slowest = Math.max(1, ...feeds.map((f) => f.ms ?? 0));
  const errors = Number(c.errors_day ?? 0);
  // AI calls per day across features, newest last, against the free tier's ~1,000.
  const aiDays = new Map<string, { calls: number; failures: number }>();
  for (const r of ai ?? []) {
    const d = aiDays.get(r.day) ?? { calls: 0, failures: 0 };
    d.calls += r.calls;
    d.failures += r.failures ?? 0;
    aiDays.set(r.day, d);
  }
  const aiRows = [...aiDays]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 10);

  return (
    <Page
      title="Live ops"
      lead="Every outside data feed checked as this page opened, today's accounts and errors, AI use, and the switches."
    >
      <Banner
        color={down.length ? TONE.bad : errors > 20 ? TONE.warn : TONE.good}
        title={
          down.length
            ? `${down.length} of ${feeds.length} data feeds down`
            : `All ${feeds.length} data feeds answering`
        }
        detail={
          down.length
            ? down.map((f) => f.name).join(", ")
            : `${errors} errors in 24 h · map on ${c.map_provider ?? "–"}`
        }
      />
      <Tiles>
        <Tile
          hero
          label="Accounts"
          value={c.members ?? "–"}
          sub={`${c.new_week ?? 0} new this week`}
          color={TONE.good}
        />
        <Tile
          label="SSWX Members"
          value={c.sswx_members ?? "–"}
          sub="team accounts"
          color={TONE.violet}
        />
        <Tile
          label="Errors, 24 h"
          value={errors}
          sub={`${c.error_groups_day ?? 0} kinds`}
          color={errors > 20 ? TONE.bad : TONE.info}
        />
        <Tile
          label="Map loads"
          value={c.map_loads ?? 0}
          sub={`on ${c.map_provider ?? "–"} · ${c.news_live ?? 0} live news posts`}
          color={TONE.pink}
        />
      </Tiles>
      <Card title="Data feeds" meta="answer time, checked just now">
        <Chips>
          {[...feeds]
            .sort(
              (a, b) =>
                Number(a.ok) - Number(b.ok) || (b.ms ?? 0) - (a.ms ?? 0),
            )
            .map((f) => (
              <div key={f.name} style={{ display: "grid", gap: 4 }}>
                <Row
                  color={
                    !f.ok
                      ? TONE.bad
                      : (f.ms ?? 0) > 2500
                        ? TONE.warn
                        : TONE.good
                  }
                  name={f.name}
                  detail={f.ok ? `${f.ms} ms` : String(f.status)}
                />
                <Meter
                  f={f.ok ? (f.ms ?? 0) / slowest : 1}
                  color={
                    !f.ok
                      ? TONE.bad
                      : (f.ms ?? 0) > 2500
                        ? TONE.warn
                        : TONE.good
                  }
                />
              </div>
            ))}
        </Chips>
      </Card>
      <Card title="AI use" meta="Gemini calls a day · free tier about 1,000">
        {!aiRows.length ? (
          <Note>No AI calls yet.</Note>
        ) : (
          <Bars
            rows={aiRows.map(([day, d]) => ({
              label: day,
              value: d.calls,
              text: `${d.calls} calls${d.failures ? ` · ${d.failures} failed` : ""} · ${Math.round(d.calls / 10)}% of the day`,
              color:
                d.calls > 800
                  ? TONE.bad
                  : d.calls > 500
                    ? TONE.warn
                    : TONE.info,
            }))}
          />
        )}
      </Card>
      <OpsForm
        modules={MODULES}
        disabled={settings.disabled}
        banner={settings.banner}
      />
    </Page>
  );
}
