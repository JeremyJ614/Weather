import type { Metadata } from "next";
import { Orbit } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { getOutlook } from "@/lib/tropical/nhc";
import { TropicalView } from "./TropicalView";

export const metadata: Metadata = {
  title: "Tropical Outlook · StormSync Media",
};
export const revalidate = 600;

export default async function TropicalOutlook() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("tropical");
  const colors = await getColors();
  const data = off ? null : await getOutlook(colors).catch(() => null);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Orbit aria-hidden />}
        eyebrow={["NHC", "Atlantic & Pacific"]}
        title="Tropical Outlook"
        subtitle="Active storms with their cones and watches, where new ones may form in the next 7 days, and live satellite."
      />
      {off ? (
        <ModuleOff label="Tropical Outlook" />
      ) : data ? (
        <TropicalView data={data} colors={colors} />
      ) : (
        <p className="text-muted">
          The National Hurricane Center feed isn&apos;t answering right now. Try
          again in a few minutes.
        </p>
      )}
    </main>
  );
}
