import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Zap } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { LightningView } from "./LightningView";

export const metadata: Metadata = pageMeta(
  "/lightning-monitoring",
  "Lightning Monitoring",
  "How close the lightning is to you and which way it's trending, the live national loop, and the busiest storms.",
);

export default async function LightningMonitoring() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("lightning");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Zap aria-hidden />}
        eyebrow={["NOAA · NLDN · GLD360", "Lightning"]}
        title="Lightning Monitoring"
        subtitle="How close the lightning is to you and which way it's trending, the live national loop, and the busiest storms."
      />
      {off ? (
        <ModuleOff label="Lightning Monitoring" />
      ) : (
        <LightningView colors={await getColors()} />
      )}
    </main>
  );
}
