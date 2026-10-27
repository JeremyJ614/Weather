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

/** The featured event's tracks, reports and storm path, projected for the phone. */
function draw(f: OtdFeature): Drawn {
  const xy = ([lon, lat]: [number, number]) => {
    const p = project(lon, lat);
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as const;
  };
  return {
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
    reports: f.reports.map((r) => {
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
