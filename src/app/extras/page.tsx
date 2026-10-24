import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { ExtrasView } from "./ExtrasView";

export const metadata: Metadata = { title: "Extras · StormSync Media" };

export default async function Extras() {
  const [{ disabled, extras }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<FlaskConical aria-hidden />}
        eyebrow={["ProbSevere", "NEXRAD", "WebGL"]}
        title="Extras"
        subtitle="Experimental weather engines built on live NOAA data, and a few visual toys for when the sky is quiet."
      />
      {disabled.includes("extras") ? (
        <ModuleOff label="Extras" />
      ) : (
        <ExtrasView colors={colors} items={extras} />
      )}
    </main>
  );
}
