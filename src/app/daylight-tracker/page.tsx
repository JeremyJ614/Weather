import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Sunrise } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { DaylightView } from "./DaylightView";

export const metadata: Metadata = pageMeta(
  "/daylight-tracker",
  "Daylight Tracker",
  "How much daylight you get today, how fast it is changing, and where you are on the year's long curve.",
);

export default async function DaylightTracker() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Sunrise aria-hidden />}
        eyebrow={["NOAA solar equations"]}
        title="Daylight Tracker"
        subtitle="How much daylight you get today, how fast it is changing, and where you are on the year's long curve."
      />
      {disabled.includes("daylight") ? (
        <ModuleOff label="The Daylight Tracker" />
      ) : (
        <DaylightView />
      )}
    </main>
  );
}
