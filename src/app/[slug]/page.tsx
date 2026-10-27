import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhaseNotice } from "@/components/PhaseNotice";
import { NavIcon } from "@/components/NavIcon";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { EXTRAS_ITEMS, stateOf } from "@/lib/extras/items";
import { ALL_PAGES } from "@/lib/nav/registry";
import { EXTRAS_GROUP } from "@/lib/nav/extras";
import { pendingPages } from "@/lib/nav/pending";
import { getSiteDefaults } from "@/lib/settings";
import { ExtraView } from "./ExtraView";

export const dynamicParams = false;

/** Pages still to be built (a phase notice), and every Extras item's own page. */
export function generateStaticParams() {
  return [...pendingPages(), ...EXTRAS_GROUP.pages].map((p) => ({
    slug: p.slug,
  }));
}

const extraOf = (slug: string) => EXTRAS_ITEMS.find((i) => i.slug === slug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = extraOf(slug);
  if (item)
    return stateOf((await getSiteDefaults()).extras, item.id) === "page"
      ? { title: `${item.name} · StormSync Media`, description: item.blurb }
      : { title: "StormSync Media" };
  const page = ALL_PAGES.find((p) => p.slug === slug);
  return {
    title: page ? `${page.label} · StormSync Media` : "StormSync Media",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = extraOf(slug);
  if (item) {
    const [{ disabled, extras }, colors] = await Promise.all([
      getSiteDefaults(),
      getColors(),
    ]);
    // Served only while the owner has it on its own page; otherwise it lives in Extras.
    if (stateOf(extras, item.id) !== "page") notFound();
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <PageHero
          icon={<NavIcon name={item.icon} />}
          eyebrow={
            item.group === "engines"
              ? ["Experimental", "Live NOAA data"]
              : ["Randoms", "WebGL"]
          }
          title={item.name}
          subtitle={item.blurb}
        />
        {disabled.includes("extras") ? (
          <ModuleOff label={item.name} />
        ) : (
          <ExtraView
            id={item.id}
            group={item.group}
            colors={colors}
            items={extras}
          />
        )}
      </main>
    );
  }
  const page = ALL_PAGES.find((p) => p.slug === slug);
  if (!page) notFound();
  return <PhaseNotice page={page.label} phase={page.phase} icon={page.icon} />;
}
