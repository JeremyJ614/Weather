import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { AuroraView } from "./AuroraView";

export const metadata: Metadata = { title: "Aurora Center · StormSync Media" };

export default async function AuroraCenter() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("aurora");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Sparkles aria-hidden />}
        eyebrow={["NOAA SWPC · OVATION", "Northern lights"]}
        title="Aurora Center"
        subtitle="Whether the aurora can reach you tonight, the live oval on a map and as SWPC's image, Kp, and the solar wind that drives it."
      />
      {off ? (
        <ModuleOff label="Aurora Center" />
      ) : (
        <AuroraView colors={await getColors()} />
      )}
    </main>
  );
}
