import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { ClimoView } from "./ClimoView";

export const metadata: Metadata = { title: "Climatology · StormSync Media" };

export default async function Climatology() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("climo");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<ChartColumn aria-hidden />}
        eyebrow={["SPC · NHC · NASA", "The long record"]}
        title="Climatology"
        subtitle="Seventy-five years of tornadoes and hurricanes and sixteen of satellite lightning: what's normal where you live, and across the country."
      />
      {off ? (
        <ModuleOff label="Climatology" />
      ) : (
        <ClimoView colors={await getColors()} />
      )}
    </main>
  );
}
