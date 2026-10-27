import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { ThermometerSun } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { cpcHazards, droughtNow, droughtTrend } from "@/lib/hazards/data";
import { HazardsView } from "./HazardsView";

export const metadata: Metadata = pageMeta(
  "/hazards-droughts",
  "Hazards & Droughts",
  "What could go wrong 3 to 14 days out, where it is dry, and whether it is getting better or worse.",
);
export const revalidate = 1800;

export default async function HazardsDroughts() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("hazards");
  const colors = await getColors();
  const [haz, now, trend] = off
    ? [null, null, []]
    : await Promise.all([
        cpcHazards(colors).catch(() => null),
        droughtNow(colors).catch(() => null),
        droughtTrend().catch(() => []),
      ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<ThermometerSun aria-hidden />}
        eyebrow={["CPC", "Drought Monitor"]}
        title="Hazards & Droughts"
        subtitle="What could go wrong 3 to 14 days out, where it is dry, and whether it is getting better or worse."
      />
      {off ? (
        <ModuleOff label="Hazards & Droughts" />
      ) : (
        <HazardsView
          hazards={haz?.list ?? null}
          national={now ? { week: now.week, pct: now.national } : null}
          trend={trend}
          colors={colors}
        />
      )}
    </main>
  );
}
