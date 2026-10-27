import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { BookA } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { FrontDoorCta } from "@/features/account/FrontDoorCta";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { TERMS, termIds } from "@/lib/glossary/terms";
import { JsonLd } from "@/components/seo/JsonLd";
import { termSet } from "@/lib/seo/schema";
import { GlossaryView } from "./GlossaryView";

export const metadata: Metadata = pageMeta(
  "/weather-glossary",
  "Weather Glossary",
  "Every term on the site in plain words: what it measures, the units, and the numbers that matter.",
);

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
      <FrontDoorCta what="the Weather Glossary" />
      {off ? (
        <ModuleOff label="Weather Glossary" />
      ) : (
        <>
          <GlossaryView />
          <JsonLd
            data={termSet(
              TERMS.map((t, i) => ({
                term: t.term,
                desc: t.desc,
                id: termIds()[i],
              })),
            )}
          />
        </>
      )}
    </main>
  );
}
