import type { Metadata } from "next";
import { BookA } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { TERMS } from "@/lib/glossary/terms";
import { GlossaryView } from "./GlossaryView";

export const metadata: Metadata = {
  title: "Weather Glossary · StormSync Media",
};

export default async function WeatherGlossary() {
  const { disabled } = await getSiteDefaults();
  const off = disabled.includes("glossary");
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<BookA aria-hidden />}
        eyebrow={["Learn", `${TERMS.length} terms`]}
        title="Weather Glossary"
        subtitle="Every term on the site in plain words: what it measures, the units, and the numbers that matter."
      />
      {off ? <ModuleOff label="Weather Glossary" /> : <GlossaryView />}
    </main>
  );
}
