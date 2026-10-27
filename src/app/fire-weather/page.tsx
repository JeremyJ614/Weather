import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Flame } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { activeFires, fireOutlook } from "@/lib/fire/data";
import { FireView } from "./FireView";

export const metadata: Metadata = pageMeta(
  "/fire-weather",
  "Fire Weather",
  "Active wildfires with their burn areas, the fires nearest you, and where weather favors new fires today and tomorrow.",
);
export const revalidate = 900;

export default async function FireWeather() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("fire");
  const colors = await getColors();
  const [fires, d1, d2] = off
    ? [null, null, null]
    : await Promise.all([
        activeFires().catch(() => null),
        fireOutlook(1, colors).catch(() => null),
        fireOutlook(2, colors).catch(() => null),
      ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Flame aria-hidden />}
        eyebrow={["NIFC", "SPC Fire Weather"]}
        title="Fire Weather"
        subtitle="Active wildfires with their burn areas, the fires nearest you, and where weather favors new fires today and tomorrow."
      />
      {off ? (
        <ModuleOff label="Fire Weather" />
      ) : (
        <FireView
          fires={fires}
          outlooks={[
            { day: 1, valid: d1?.valid ?? null, areas: d1?.areas ?? null },
            { day: 2, valid: d2?.valid ?? null, areas: d2?.areas ?? null },
          ]}
          colors={colors}
        />
      )}
    </main>
  );
}
