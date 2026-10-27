import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Star } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { StarsView } from "./StarsView";

export const metadata: Metadata = pageMeta(
  "/star-gazing",
  "Star Gazing Forecast",
  "How good the sky will be tonight, where the clearest dark skies are, and what to point at.",
);

export default async function StarGazing() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("sky");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Star aria-hidden />}
        eyebrow={["Clouds · Moon · Darkness", "Night sky"]}
        title="Star Gazing Forecast"
        subtitle="How good the sky will be tonight, where the clearest dark skies are, and what to point at."
      />
      {off ? (
        <ModuleOff label="Star Gazing Forecast" />
      ) : (
        <StarsView colors={await getColors()} />
      )}
    </main>
  );
}
