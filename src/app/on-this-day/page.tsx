import type { Metadata } from "next";
import { after } from "next/server";
import { CalendarDays } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { ensureDay, readDay, todayMd, validMd } from "@/lib/history/days";
import { buildDay, type OtdData } from "@/lib/history/onthisday";
import { dateName } from "@/lib/history/story";
import { project } from "@/lib/map/usAlbers";
import { getSiteDefaults } from "@/lib/settings";
import { OnThisDayView } from "./OnThisDayView";

export const metadata: Metadata = {
  title: "On This Day in Weather History · StormSync Media",
};

/** Map lines are projected here, so the phone gets ready-to-draw paths. */
function paths(d: OtdData) {
  return d.tornadoes.paths.map((p) => {
    const a = project(p.a[0], p.a[1]);
    const b = p.b ? project(p.b[0], p.b[1]) : null;
    const d =
      b && Math.hypot(b.x - a.x, b.y - a.y) > 0.6
        ? `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
        : `M${a.x.toFixed(1)} ${a.y.toFixed(1)}h0.01`;
    return { d, mag: p.mag };
  });
}

export default async function OnThisDay({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const [{ d }, { disabled }, colors] = await Promise.all([
    searchParams,
    getSiteDefaults(),
    getColors(),
  ]);
  const today = todayMd();
  const md = validMd(d) ? d! : today;
  const hero = (
    <PageHero
      icon={<CalendarDays aria-hidden />}
      eyebrow={["SPC tornado records", "NHC best tracks"]}
      title="On This Day"
      subtitle={`${dateName(md)} in weather history: the tornadoes and hurricanes NOAA has on record for the date, and the stories behind them.`}
    />
  );
  if (disabled.includes("onthisday"))
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {hero}
        <ModuleOff label="On This Day" />
      </main>
    );

  const stored = await readDay(md);
  let data = stored?.data ?? null;
  if (!data) data = await buildDay(md).catch(() => null);
  // A date nobody has opened yet is stored, with its stories, after this visit.
  if (!stored?.story && process.env.SUPABASE_SERVICE_ROLE_KEY)
    after(() => ensureDay(md).catch(() => undefined));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {hero}
      <OnThisDayView
        md={md}
        today={today}
        data={data}
        story={stored?.story ?? null}
        paths={data ? paths(data) : []}
        colors={colors}
      />
    </main>
  );
}
