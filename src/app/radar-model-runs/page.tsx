import type { Metadata } from "next";
import { Radar } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { RadarView } from "./RadarView";

export const metadata: Metadata = {
  title: "Radar & Model Runs · StormSync Media",
};

export default async function RadarModelRuns() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Radar aria-hidden />}
        eyebrow={["NEXRAD · MRMS · GOES", "NOAA models"]}
        title="Radar & Model Runs"
        subtitle="Looping radar, MRMS and satellite, HRRR, GFS and ensemble maps rendered from NOAA's data, a 15-minute nowcast, and every model's forecast for your spot."
      />
      {disabled.includes("radar") ? (
        <ModuleOff label="Radar & Model Runs" />
      ) : (
        <RadarView colors={colors} />
      )}
    </main>
  );
}
