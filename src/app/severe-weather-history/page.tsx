import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { History } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { tornadoHome } from "@/lib/tornado/home";
import { HistoryView } from "./HistoryView";

export const metadata: Metadata = pageMeta(
  "/severe-weather-history",
  "Severe Weather History",
  "Every surveyed tornado track and every severe warning, by day, month or year, on one fast map, and the Tornado Database: every tornado in every US county since 1950.",
);

export default async function SevereWeatherHistory() {
  const [{ disabled }, colors, db] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    tornadoHome(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<History aria-hidden />}
        eyebrow={["NWS surveys", "Warning archive"]}
        title="Severe Weather History"
        subtitle="Every surveyed tornado track and every severe warning, by day, month or year, on one fast map, and every county's tornado record since 1950."
      />
      {disabled.includes("history") ? (
        <ModuleOff label="Severe Weather History" />
      ) : (
        <HistoryView
          colors={colors}
          year={new Date().getUTCFullYear()}
          db={disabled.includes("tornado-database") ? null : db}
        />
      )}
    </main>
  );
}
