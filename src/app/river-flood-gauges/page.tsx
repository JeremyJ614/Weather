import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Droplets } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { elevated, forecastFloods } from "@/lib/rivers/data";
import { RiversView } from "./RiversView";

export const metadata: Metadata = pageMeta(
  "/river-flood-gauges",
  "River & Flood Gauges",
  "The five worst rivers in the country right now, the ones forecast to flood, and the gauges nearest you.",
);
export const revalidate = 600;

export default async function RiverFloodGauges() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("rivers");
  const [now, ahead, colors] = off
    ? [null, null, {}]
    : await Promise.all([
        elevated().catch(() => null),
        forecastFloods().catch(() => null),
        getColors(),
      ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Droplets aria-hidden />}
        eyebrow={["NWS", "River forecasts"]}
        title="River & Flood Gauges"
        subtitle="The five worst rivers in the country right now, the ones forecast to flood, and the gauges nearest you."
      />
      {off ? (
        <ModuleOff label="River & Flood Gauges" />
      ) : now ? (
        <RiversView now={now} ahead={ahead} colors={colors} />
      ) : (
        <p className="text-muted">
          The national river gauge service isn&apos;t answering right now. Try
          again in a few minutes.
        </p>
      )}
    </main>
  );
}
