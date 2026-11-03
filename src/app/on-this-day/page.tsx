import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { CalendarDays } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { FrontDoorCta } from "@/features/account/FrontDoorCta";
import { ShareButton } from "@/components/ShareButton";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { ensureDay, readDay, todayMd } from "@/lib/history/days";
import type { OtdFeature } from "@/lib/history/onthisday";
import { dateName } from "@/lib/history/story";
import { project } from "@/lib/map/usAlbers";
import { getSiteDefaults } from "@/lib/settings";
import { OnThisDayView, type Drawn } from "./OnThisDayView";

export const metadata: Metadata = pageMeta(
  "/on-this-day",
  "On This Day in Weather History",
  "One famous storm from today's date in history, told like a story, with its tornado tracks, reports or hurricane path on the map.",
);
// Always today's date (Central time); the stored day is read through the data cache.
export const dynamic = "force-dynamic";

/** The map canvas (Albers USA), and the closest the map opens on a small event (about 8×). */
const W = 975;
const H = 610;
const MIN_W = 120;

/** The full range, or (for scattered reports) the middle 90%: one stray report shouldn't set the frame. */
const span = (v: number[], trim: boolean) => {
  const a = [...v].sort((p, q) => p - q);
  const at = (q: number) => a[Math.min(a.length - 1, Math.floor(q * a.length))];
  return trim && a.length > 12 ? [at(0.05), at(0.95)] : [a[0], a[a.length - 1]];
};

/**
 * The tightest view, at the map's shape, that holds the event with a margin: the event fills
 * the map when it opens, and Zoom & pan still goes out to the whole country.
 */
function fit(pts: (readonly [number, number])[], trim: boolean): Drawn["view"] {
  const on = pts.filter(([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H);
  if (!on.length) return undefined;
  const [x0, x1] = span(
    on.map((p) => p[0]),
    trim,
  );
  const [y0, y1] = span(
    on.map((p) => p[1]),
    trim,
  );
  const w = Math.min(
    W,
    Math.max(MIN_W, (x1 - x0) * 1.35, ((y1 - y0) * 1.35 * W) / H),
  );
  const h = (w * H) / W;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    x: round(Math.min(W - w, Math.max(0, (x0 + x1) / 2 - w / 2))),
    y: round(Math.min(H - h, Math.max(0, (y0 + y1) / 2 - h / 2))),
    w: round(w),
  };
}

/** Canvas units (~4.6 km each) within which two tracks belong to the same storm event. */
const LINK = 55;

/**
 * The day's main event: tracks link when they come within LINK of each other (transitively,
 * so an outbreak across states stays one), and the cluster with the most violent weight wins.
 * A lone tornado far away is on the map but doesn't pull the frame out.
 */
function mainCluster(
  tracks: { pts: (readonly [number, number])[]; mag: number }[],
) {
  const up = tracks.map((_, i) => i);
  const root = (i: number): number => (up[i] === i ? i : (up[i] = root(up[i])));
  const near = (a: (typeof tracks)[number], b: (typeof tracks)[number]) =>
    a.pts.some((p) =>
      b.pts.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= LINK),
    );
  for (let i = 0; i < tracks.length; i++)
    for (let j = i + 1; j < tracks.length; j++)
      if (near(tracks[i], tracks[j])) up[root(i)] = root(j);
  const weight = new Map<number, number>();
  tracks.forEach((t, i) =>
    weight.set(
      root(i),
      (weight.get(root(i)) ?? 0) + (Math.max(0, t.mag) + 2) ** 2,
    ),
  );
  const best = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0];
  return tracks.filter((_, i) => root(i) === best).flatMap((t) => t.pts);
}

/** The featured event's tracks, reports and storm path, projected for the phone. */
function draw(f: OtdFeature): Drawn {
  const xy = ([lon, lat]: [number, number]) => {
    const p = project(lon, lat);
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as const;
  };
  // Wind reports bury the tracks on a tornado day (owner, 2026-11-02); a windstorm keeps them.
  const reports = f.reports.filter((r) => f.kind === "wind" || r.k !== "wind");
  // The event is its tracks (or the hurricane's path); reports frame it only on a day without.
  const marks = f.storm
    ? [...f.storm.pts.map((p) => xy([p[0], p[1]])), xy(f.storm.land)]
    : f.tracks.length
      ? mainCluster(
          f.tracks.map((t) => ({
            pts: t.b ? [xy(t.a), xy(t.b)] : [xy(t.a)],
            mag: t.mag,
          })),
        )
      : reports.map((r) => xy(r.p));
  return {
    view: fit(marks, !f.storm && !f.tracks.length),
    tracks: f.tracks.map((t) => {
      const [ax, ay] = xy(t.a);
      const b = t.b ? xy(t.b) : null;
      return {
        d:
          b && Math.hypot(b[0] - ax, b[1] - ay) > 0.6
            ? `M${ax} ${ay}L${b[0]} ${b[1]}`
            : `M${ax} ${ay}h0.01`,
        mag: t.mag,
      };
    }),
    reports: reports.map((r) => {
      const [x, y] = xy(r.p);
      return { k: r.k, x, y };
    }),
    storm: f.storm
      ? {
          segs: f.storm.pts.slice(1).map((p, i) => {
            const [ax, ay] = xy([f.storm!.pts[i][0], f.storm!.pts[i][1]]);
            const [bx, by] = xy([p[0], p[1]]);
            return { d: `M${ax} ${ay}L${bx} ${by}`, kt: p[2] };
          }),
          land: xy(f.storm.land),
        }
      : null,
  };
}

export default async function OnThisDay() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  const md = todayMd();
  const hero = (
    <div className="mb-4 grid gap-3">
      <PageHero
        icon={<CalendarDays aria-hidden />}
        eyebrow={["NOAA records", "Weather history"]}
        title="On This Day"
        subtitle={`${dateName(md)} in weather history: one storm that made its mark on this date, and its story.`}
      />
      <FrontDoorCta what="On This Day" />
      <ShareButton
        title={`On this day in weather history: ${dateName(md)}`}
        className="justify-self-start"
      />
    </div>
  );
  if (disabled.includes("onthisday"))
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {hero}
        <ModuleOff label="On This Day" />
      </main>
    );

  const stored = await readDay(md);
  const story = stored?.story && "title" in stored.story ? stored.story : null;
  // Today's date not ready yet (the morning job makes it), or its story is to be redone
  // (Wikipedia didn't answer): do it after this visit.
  if (
    (!stored?.data.feature || !story || story.retry) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    after(async () => {
      await ensureDay(md).catch(() => undefined);
      revalidateTag(`history:${md}`, { expire: 0 });
    });
  const f = stored?.data.feature ?? null;

  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {hero}
      <OnThisDayView
        md={md}
        feature={f}
        story={story}
        drawn={f ? draw(f) : null}
        colors={colors}
      />
    </main>
  );
}
