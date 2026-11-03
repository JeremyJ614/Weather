import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Snowflake } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import {
  OVERLAYS,
  OVERLAY_GROUPS,
  citySnow,
  nationalWinterAlerts,
  probSummary,
} from "@/lib/winter/data";
import { WinterView } from "./WinterView";

export const metadata: Metadata = pageMeta(
  "/winter-center",
  "Winter Center",
  "How bad winter weather gets and where, the odds of heavy snow and ice, what is in effect, and hour by hour where you are.",
);
export const revalidate = 900;

export default async function WinterCenter() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("winter");
  const [odds, alerts, cities, colors] = off
    ? [{}, null, null, {}]
    : await Promise.all([
        probSummary().catch(() => ({})),
        nationalWinterAlerts().catch(() => null),
        citySnow().catch(() => null),
        getColors(),
      ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Snowflake aria-hidden />}
        eyebrow={["WPC", "Winter Weather"]}
        title="Winter Center"
        subtitle="How bad winter weather gets and where, the odds of heavy snow and ice, what is in effect, and hour by hour where you are."
      />
      {off ? (
        <ModuleOff label="Winter Center" />
      ) : (
        <WinterView
          groups={[...OVERLAY_GROUPS]}
          overlays={Object.entries(OVERLAYS).map(([id, o]) => ({
            id,
            group: o.group,
            hours: o.hours ?? null,
            label: o.label,
            note: o.note,
            bounds: o.bounds,
          }))}
          odds={odds}
          alerts={alerts}
          cities={cities}
          colors={colors}
        />
      )}
    </main>
  );
}
