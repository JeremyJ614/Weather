import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Bug } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { MosquitoView } from "./MosquitoView";

export const metadata: Metadata = pageMeta(
  "/mosquito-index",
  "Mosquito Index",
  "How active mosquitoes will be, hour by hour, from temperature, humidity, rain and wind, and when to protect yourself.",
);

export default async function MosquitoIndex() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Bug aria-hidden />}
        eyebrow={["NWS hourly forecast", "SSWX activity model"]}
        title="Mosquito Index"
        subtitle="How active mosquitoes will be, hour by hour, from temperature, humidity, rain and wind, and when to protect yourself."
      />
      {disabled.includes("mosquito") ? (
        <ModuleOff label="The Mosquito Index" />
      ) : (
        <MosquitoView />
      )}
    </main>
  );
}
