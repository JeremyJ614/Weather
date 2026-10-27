import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { History } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { HistoryView } from "./HistoryView";

export const metadata: Metadata = pageMeta(
  "/severe-weather-history",
  "Severe Weather History",
  "Every surveyed tornado track and every severe warning, by day, month or year, on one fast map.",
);

export default async function SevereWeatherHistory() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<History aria-hidden />}
        eyebrow={["NWS surveys", "Warning archive"]}
        title="Severe Weather History"
        subtitle="Every surveyed tornado track and every severe warning, by day, month or year, on one fast map."
      />
      {disabled.includes("history") ? (
        <ModuleOff label="Severe Weather History" />
      ) : (
        <HistoryView colors={colors} year={new Date().getUTCFullYear()} />
      )}
    </main>
  );
}
