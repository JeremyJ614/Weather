import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { checkFeeds } from "@/lib/ops/feeds";
import { MODULES } from "@/lib/ops/modules";
import { getSiteDefaults } from "@/lib/settings";
import { OpsForm } from "./OpsForm";

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
  const tiles: [string, string | number][] = [
    ["Accounts", c.members ?? "–"],
    ["New this week", c.new_week ?? "–"],
    ["SSWX Members", c.sswx_members ?? "–"],
    ["Errors, 24 h", `${c.errors_day ?? 0} (${c.error_groups_day ?? 0} kinds)`],
    ["Map", `${c.map_provider ?? "–"} · ${c.map_loads ?? 0} loads`],
    ["Live news posts", c.news_live ?? "–"],
  ];
  const down = feeds.filter((f) => !f.ok).length;

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Live ops</h1>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-line bg-surface p-3"
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-bold">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="font-bold">
          Data feeds{" "}
          <span className={`text-sm ${down ? "text-accent" : "text-muted"}`}>
            · {down ? `${down} down` : "all up"} · checked just now
          </span>
        </h2>
        <ul className="grid gap-1.5">
          {feeds.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${f.ok ? "bg-muted" : "bg-accent"}`}
                  aria-hidden
                />
                {f.name}
              </span>
              <span className={f.ok ? "text-muted" : "font-bold text-accent"}>
                {f.ok ? `${f.ms} ms` : `${f.status}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h2 className="font-bold">
          AI usage{" "}
          <span className="text-sm text-muted">
            · Gemini calls per day (free tier allows about 1,000 a day)
          </span>
        </h2>
        {!ai?.length ? (
          <p className="text-sm text-muted">No AI calls yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {ai.map((r) => (
              <li
                key={r.day + r.feature}
                className="flex justify-between rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              >
                <span>
                  {r.day} · {r.feature}
                </span>
                <span
                  className={
                    r.calls > 800 ? "font-bold text-accent" : "text-muted"
                  }
                >
                  {r.calls} calls{r.failures ? `, ${r.failures} failed` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <OpsForm
        modules={MODULES}
        disabled={settings.disabled}
        banner={settings.banner}
      />
    </main>
  );
}
