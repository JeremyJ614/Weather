import type { Metadata } from "next";
import { Moon } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { AstroView } from "./AstroView";

export const metadata: Metadata = { title: "Astronomy · StormSync Media" };

export default async function Astronomy() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("astronomy");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Moon aria-hidden />}
        eyebrow={["USNO algorithms · JPL elements", "Moon & sky"]}
        title="Astronomy"
        subtitle="The moon at its real phase, the planets you can see tonight, the sun's day, and the sky calendar ahead."
      />
      {off ? (
        <ModuleOff label="Astronomy" />
      ) : (
        <AstroView colors={await getColors()} />
      )}
    </main>
  );
}
