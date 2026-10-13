import type { Metadata } from "next";
import { Atom } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { pick } from "@/lib/colors/pick";
import { getColors } from "@/lib/colors/server";
import { PASTEL, type Pastel } from "@/lib/ingredients/calc";
import { getSiteDefaults } from "@/lib/settings";
import { IngredientsView } from "./IngredientsView";

export const metadata: Metadata = {
  title: "Atmospheric Ingredients · StormSync Media",
};

export default async function AtmosphericIngredients() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  const tones = Object.fromEntries(
    Object.entries(PASTEL).map(([k, v]) => [k, pick(colors, `ing:${k}`, v)]),
  ) as Record<Pastel, string>;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Atom aria-hidden />}
        eyebrow={["Instability", "Shear", "Helicity"]}
        title="Atmospheric Ingredients"
        subtitle="The ingredients storms are built from, hour by hour for your place: how much fuel, how much spin, and when they line up."
      />
      {disabled.includes("ingredients") ? (
        <ModuleOff label="Atmospheric Ingredients" />
      ) : (
        <IngredientsView tones={tones} />
      )}
    </main>
  );
}
