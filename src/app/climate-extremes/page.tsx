import type { Metadata } from "next";
import { Thermometer } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { liveExtremes, weekRecords } from "@/lib/extremes/data";
import { project } from "@/lib/map/usAlbers";
import { getSiteDefaults } from "@/lib/settings";
import { ExtremesView, type Placed } from "./ExtremesView";

export const metadata: Metadata = {
  title: "Climate Extremes Tracker · StormSync Media",
};

// Served from the edge and rebuilt every 10 minutes: the station feed is national and the
// same for everyone. The view shows when its numbers were read.
export const dynamic = "force-static";
export const revalidate = 600;

export default async function ClimateExtremes() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  const hero = (
    <PageHero
      icon={<Thermometer aria-hidden />}
      eyebrow={["ASOS stations", "NWS record reports"]}
      title="Climate Extremes"
      subtitle="The hottest, coldest, windiest and stormiest readings in the country right now, and every record the Weather Service has reported this week."
    />
  );
  if (disabled.includes("extremes"))
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {hero}
        <ModuleOff label="Climate Extremes" />
      </main>
    );
  const [live, records] = await Promise.all([
    liveExtremes().catch(() => null),
    weekRecords().catch(() => []),
  ]);
  // The leaders of each measure, placed on the national map here (the phone draws dots).
  const placed = live
    ? (Object.fromEntries(
        Object.entries(live.scopes).map(([scope, m]) => [
          scope,
          Object.fromEntries(
            Object.entries(m).map(([k, list]) => [
              k,
              list.map((st) => {
                const p = project(st.lon, st.lat);
                const on = p.x >= 0 && p.x <= 975 && p.y >= 0 && p.y <= 610;
                return { ...st, x: on ? p.x : null, y: on ? p.y : null };
              }),
            ]),
          ),
        ]),
      ) as Placed)
    : null;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      {hero}
      <ExtremesView
        live={placed}
        at={live?.at ?? null}
        stations={live?.stations ?? 0}
        records={records}
        colors={colors}
      />
    </main>
  );
}
