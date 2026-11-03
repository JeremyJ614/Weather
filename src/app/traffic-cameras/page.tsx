import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { notFound } from "next/navigation";
import { Cctv } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { canSeeCams } from "@/lib/cams/access";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { TrafficView } from "./TrafficView";

export const metadata: Metadata = pageMeta(
  "/traffic-cameras",
  "Traffic Cameras",
  "Live stills from road, road-weather and wildfire cameras: the ones near you, the ones inside active warnings, and every one on the map.",
);

export default async function TrafficCameras() {
  if (!(await canSeeCams())) notFound();
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("cams");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Cctv aria-hidden />}
        eyebrow={["DOT · Wildfire cams", "Eyes on the road"]}
        title="Traffic Cameras"
        subtitle="Live stills from road, road-weather and wildfire cameras: the ones near you, the ones inside active warnings, and every one on the map."
      />
      {off ? (
        <ModuleOff label="Traffic Cameras" />
      ) : (
        <TrafficView colors={await getColors()} />
      )}
    </main>
  );
}
