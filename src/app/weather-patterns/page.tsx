import type { Metadata } from "next";
import { Wind } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { eroDays } from "@/lib/flood/data";
import { cpcHazards } from "@/lib/hazards/data";
import { patternIndex, regionalOutlook } from "@/lib/patterns/data";
import { PatternsView } from "./PatternsView";

export const metadata: Metadata = {
  title: "Weather Patterns · StormSync Media",
};
export const revalidate = 1800;

export default async function WeatherPatterns() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("patterns");
  const [outlook, index, ero, cpc, colors] = off
    ? [null, null, null, null, {}]
    : await Promise.all([
        regionalOutlook().catch(() => null),
        patternIndex().catch(() => null),
        eroDays().catch(() => null),
        cpcHazards().catch(() => null),
        getColors(),
      ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Wind aria-hidden />}
        eyebrow={["SPC", "WPC", "CPC", "Nationwide"]}
        title="Weather Patterns"
        subtitle="The national picture today, the week ahead by region, and what has already happened: the past week, month and year, summed up."
      />
      {off ? (
        <ModuleOff label="Weather Patterns" />
      ) : (
        <PatternsView
          outlook={outlook}
          index={index}
          eroTop={ero ? Math.max(0, ...ero.map((d) => d.top)) : null}
          eroDay={
            ero
              ? (ero.find((d) => d.top === Math.max(...ero.map((x) => x.top)))
                  ?.day ?? null)
              : null
          }
          hazards={cpc ? [...new Set(cpc.list.map((h) => h.label))] : null}
          colors={colors}
        />
      )}
    </main>
  );
}
