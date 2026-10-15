import type { Metadata } from "next";
import { Box } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { SoundingsView } from "./SoundingsView";

export const metadata: Metadata = { title: "3D Soundings · StormSync Media" };

export default async function Soundings() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("soundings");
  const colors = off ? {} : await getColors();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Box aria-hidden />}
        eyebrow={["Balloons · HRRR · RAP · NAM · GFS", "Upper air"]}
        title="3D Soundings"
        subtitle="Tap a balloon site or any point on the map to see the atmosphere above it in 3D, on a Skew-T and on a hodograph."
      />
      {off ? (
        <ModuleOff label="3D Soundings" />
      ) : (
        <SoundingsView colors={colors} />
      )}
    </main>
  );
}
