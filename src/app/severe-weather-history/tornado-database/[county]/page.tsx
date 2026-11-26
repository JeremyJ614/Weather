import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo/site";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { STATES } from "@/lib/geo/search";
import { countyData } from "@/lib/tornado/db";
import { withSurveys } from "@/lib/tornado/dat";
import { TDB, summary } from "@/lib/tornado/view";
import { CountyPage } from "../County";
import { TabLinks } from "../TabLinks";

// One page per county, built the first time someone opens it, then refreshed daily so new
// NWS damage surveys arrive.
export const revalidate = 86400;

type Props = { params: Promise<{ county: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county } = await params;
  const base = await countyData(county);
  if (!base) return {};
  const d = await withSurveys(base);
  const place = `${d.county.name}, ${d.county.st}`;
  return pageMeta(
    `${TDB}/${county}`,
    `${place} tornado history`,
    summary(
      d.tors,
      d.county.name,
      STATES[d.county.st] ?? d.county.st,
      d.through,
    ).slice(0, 300),
  );
}

export default async function County({ params }: Props) {
  const { county } = await params;
  const [{ disabled }, colors, base] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    countyData(county),
  ]);
  if (!base) notFound();
  const d = await withSurveys(base);
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">
      <TabLinks />
      {disabled.includes("history") || disabled.includes("tornado-database") ? (
        <ModuleOff label="Tornado Database" />
      ) : (
        <CountyPage d={d} colors={colors} />
      )}
    </main>
  );
}
