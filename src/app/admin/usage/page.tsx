import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { EVERY_PAGE } from "@/lib/nav/extras";
import {
  Area,
  Bars,
  Banner,
  Card,
  Note,
  Page,
  Tile,
  Tiles,
  TONE,
} from "@/components/admin/Dash";

export const metadata: Metadata = {
  title: "Page usage · Admin · StormSync Media",
};

const DAYS = 30;
const label = new Map(EVERY_PAGE.map((p) => [p.slug, p.label]));
const dayKey = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const now = () => new Date();

/** Which pages members open (VIP #45): by day, viewers per page, pages per member. */
export default async function Usage() {
  const { supabase } = await requireAdmin("usage");
  const start = new Date(now().getTime() - (DAYS - 1) * 86400000);
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
  const series = days.map((d) => byDay.get(d)!.people.size);
  const views = days.map((d) => byDay.get(d)!.views);
  const half = Math.floor(DAYS / 2);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const before = sum(series.slice(0, half));
  const after = sum(series.slice(half));
  const trend = before ? Math.round(((after - before) / before) * 100) : null;
  const unique = byMember.size;
  const totalViews = sum(views);
  const today = series.at(-1) ?? 0;
  const pages = [...byPage].sort(
    (a, b) => b[1].people.size - a[1].people.size || b[1].views - a[1].views,
  );
  const members = [...byMember]
    .sort((a, b) => b[1].pages.size - a[1].pages.size)
    .slice(0, 25);
  const pageName = (s: string) => label.get(s) ?? (s ? `/${s}` : "Homepage");

  return (
    <Page
      title="Page usage"
      lead={`Signed-in members over the last ${DAYS} days: one count per page, member and day (not while viewing as a member). Kept 180 days.`}
    >
      <Banner
        color={trend == null ? TONE.info : trend >= 0 ? TONE.good : TONE.warn}
        title={
          trend == null
            ? `${unique} members opened pages this month`
            : `Daily members ${trend >= 0 ? "up" : "down"} ${Math.abs(trend)}% on the first half of the month`
        }
        detail={`${totalViews.toLocaleString("en-US")} page views · ${pages.length} pages visited`}
      />
      <Tiles>
        <Tile
          hero
          label="Active members"
          value={unique}
          sub={`in ${DAYS} days`}
          color={TONE.good}
        />
        <Tile
          label="Today"
          value={today}
          sub="members so far"
          color={TONE.info}
        />
        <Tile
          label="Daily average"
          value={(sum(series) / DAYS).toFixed(1)}
          sub="members a day"
          color={TONE.violet}
        />
        <Tile
          label="Views per member"
          value={unique ? (totalViews / unique).toFixed(1) : "0"}
          sub="over the month"
          color={TONE.pink}
        />
      </Tiles>
      <Card title="Members each day" meta={`${DAYS} days`}>
        <Area
          values={series}
          from={days[0]}
          to={days.at(-1) ?? ""}
          label="Members per day"
          color={TONE.good}
        />
      </Card>
      <Card title="Most visited pages" meta="by members, then views">
        {!pages.length ? (
          <Note>No visits counted yet.</Note>
        ) : (
          <Bars
            rows={pages.slice(0, 20).map(([slug, p]) => ({
              label: pageName(slug),
              value: p.people.size,
              text: `${p.people.size} members · ${p.views} views · ${unique ? Math.round((p.people.size / unique) * 100) : 0}%`,
              color: TONE.info,
            }))}
          />
        )}
      </Card>
      {pages.length > 20 && (
        <Card title="Least visited" meta="pages members rarely open">
          <Bars
            rows={pages
              .slice(-8)
              .reverse()
              .map(([slug, p]) => ({
                label: pageName(slug),
                value: p.people.size,
                text: `${p.people.size} members · ${p.views} views`,
                color: TONE.warn,
              }))}
          />
        </Card>
      )}
      <Card title="Most active members" meta="pages each opened">
        {!members.length ? (
          <Note>No visits counted yet.</Note>
        ) : (
          <Bars
            rows={members.map(([id, m]) => ({
              label: (
                <details>
                  <summary className="cursor-pointer">
                    {name.get(id) ?? "Removed member"}
                  </summary>
                  <small className="text-muted">
                    {[...m.pages].map(pageName).join(", ")}
                  </small>
                </details>
              ),
              value: m.pages.size,
              text: `${m.pages.size} pages · ${m.views} views`,
              color: TONE.violet,
            }))}
          />
        )}
      </Card>
    </Page>
  );
}
