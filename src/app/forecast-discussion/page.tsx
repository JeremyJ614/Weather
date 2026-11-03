import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { MessageSquareText } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { Discussion } from "./Discussion";

export const metadata: Metadata = pageMeta(
  "/forecast-discussion",
  "Forecast Discussion",
  "The forecaster's own reasoning behind your forecast: what they see, what worries them, and how sure they are.",
);

export default async function ForecastDiscussion() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<MessageSquareText aria-hidden />}
        eyebrow={["NWS Area Forecast Discussion"]}
        title="Forecast Discussion"
        subtitle="The forecaster's own reasoning behind your forecast: what they see, what worries them, and how sure they are."
      />
      {disabled.includes("discussion") ? (
        <ModuleOff label="Forecast Discussion" />
      ) : (
        <Discussion />
      )}
    </main>
  );
}
