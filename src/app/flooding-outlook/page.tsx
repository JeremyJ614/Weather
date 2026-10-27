import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Waves } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { eroDays } from "@/lib/flood/data";
import { FloodView } from "./FloodView";

export const metadata: Metadata = pageMeta(
  "/flooding-outlook",
  "Flooding Outlook",
  "Where rain may outrun what the ground can take, five days out, tested at your location.",
);
export const revalidate = 1800;

export default async function FloodingOutlook() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("flooding");
  const [days, colors] = off
    ? [[], {}]
    : await Promise.all([eroDays().catch(() => []), getColors()]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Waves aria-hidden />}
        eyebrow={["WPC", "Excessive Rainfall"]}
        title="Flooding Outlook"
        subtitle="Where rain may outrun what the ground can take, five days out, tested at your location."
      />
      {off ? (
        <ModuleOff label="Flooding Outlook" />
      ) : days.length ? (
        <FloodView days={days} colors={colors} />
      ) : (
        <p className="text-muted">
          WPC&apos;s outlook isn&apos;t answering right now. Try again in a few
          minutes.
        </p>
      )}
    </main>
  );
}
