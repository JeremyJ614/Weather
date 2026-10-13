import type { Metadata } from "next";
import { Wind } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { AirView } from "./AirView";

export const metadata: Metadata = { title: "AQI & Pollen · StormSync Media" };

export default async function AqiPollen() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Wind aria-hidden />}
        eyebrow={["EPA breakpoints", "CAMS", "Google Pollen"]}
        title="Air Quality & Allergy"
        subtitle="What is in the air where you are, how readily it is moving around, and what to do about it."
      />
      {disabled.includes("air") ? (
        <ModuleOff label="AQI & Pollen" />
      ) : (
        <AirView />
      )}
    </main>
  );
}
