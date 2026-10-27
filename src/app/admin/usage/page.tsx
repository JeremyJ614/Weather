import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { EVERY_PAGE } from "@/lib/nav/extras";

export const metadata: Metadata = {
  title: "Page usage · Admin · StormSync Media",
};

const DAYS = 30;
const label = new Map(EVERY_PAGE.map((p) => [p.slug, p.label]));
const dayKey = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const today = () => new Date();

/** Which pages members open (VIP #45): by day, viewers per page, pages per member. */
export default async function Usage() {
  const { supabase } = await requireAdmin("usage");
  const start = new Date(today().getTime() - (DAYS - 1) * 86400000);
  const [{ data }, { data: people }] = await Promise.all([
    supabase
      .from("page_views")
      .select("day, slug, user_id, views")
      .gte("day", dayKey(start))
      .limit(50000),
    supabase.from("profiles").select("id, first_name, last_name"),
  ]);
  const rows = data ?? [];
  const name = new Map(
    (people ?? []).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name.slice(0, 1)}.`,
    ]),
  );
  const days = Array.from({ length: DAYS }, (_, i) =>
    dayKey(new Date(start.getTime() + i * 86400000)),
  );
  const byDay = new Map(
    days.map((d) => [d, { views: 0, people: new Set<string>() }]),
  );
  const byPage = new Map<string, { views: number; people: Set<string> }>();
  const byMember = new Map<string, { views: number; pages: Set<string> }>();
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (d) {
      d.views += r.views;
      d.people.add(r.user_id);
    }
    const p = byPage.get(r.slug) ?? { views: 0, people: new Set<string>() };
    p.views += r.views;
    p.people.add(r.user_id);
    byPage.set(r.slug, p);
    const m = byMember.get(r.user_id) ?? { views: 0, pages: new Set<string>() };
    m.views += r.views;
    m.pages.add(r.slug);
    byMember.set(r.user_id, m);
  }
  const peak = Math.max(1, ...[...byDay.values()].map((d) => d.people.size));
  const pages = [...byPage].sort(
    (a, b) => b[1].people.size - a[1].people.size || b[1].views - a[1].views,
  );
  const members = [...byMember]
    .sort((a, b) => b[1].pages.size - a[1].pages.size)
    .slice(0, 40);
  const pageName = (s: string) => label.get(s) ?? (s ? `/${s}` : "Homepage");

  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Page usage</h1>
        <p className="mt-1 text-sm text-muted">
          Signed-in members over the last {DAYS} days (one count per page,
          member and day; not while viewing as a member). Kept 180 days.
        </p>
      </div>
      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Members each day</h2>
        <div
          className="flex h-28 items-end gap-[2px]"
          role="img"
          aria-label="Members per day"
        >
          {days.map((d) => {
            const v = byDay.get(d)!;
            return (
              <span
                key={d}
                title={`${d}: ${v.people.size} members, ${v.views} views`}
                className="flex-1 rounded-t bg-[var(--lit-line)]"
                style={{
                  height: `${Math.max(2, (v.people.size / peak) * 100)}%`,
                }}
              />
            );
          })}
        </div>
        <p className="flex justify-between text-[11px] text-muted">
          <span>{days[0]}</span>
          <span>peak {peak}</span>
          <span>{days.at(-1)}</span>
        </p>
      </section>
      <section className="grid gap-1 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">Viewers per page</h2>
        {!pages.length && (
          <p className="text-sm text-muted">No visits counted yet.</p>
        )}
        {pages.map(([slug, p]) => (
          <p
            key={slug}
            className="flex justify-between gap-3 text-sm tabular-nums"
          >
            <span className="min-w-0 truncate">{pageName(slug)}</span>
            <span className="text-muted">
              {p.people.size} members · {p.views} views
            </span>
          </p>
        ))}
      </section>
      <section className="grid gap-1 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-1 font-bold">Pages per member</h2>
        {!members.length && (
          <p className="text-sm text-muted">No visits counted yet.</p>
        )}
        {members.map(([id, m]) => (
          <details key={id}>
            <summary className="flex cursor-pointer justify-between gap-3 text-sm tabular-nums">
              <span>{name.get(id) ?? "Removed member"}</span>
              <span className="text-muted">
                {m.pages.size} pages · {m.views} views
              </span>
            </summary>
            <p className="pb-2 text-xs text-muted">
              {[...m.pages].map(pageName).join(", ")}
            </p>
          </details>
        ))}
      </section>
    </main>
  );
}
