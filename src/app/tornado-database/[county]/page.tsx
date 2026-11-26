import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo/site";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { STATES } from "@/lib/geo/search";
import { countyData } from "@/lib/tornado/db";
import { summary } from "@/lib/tornado/view";
import { CountyPage } from "../County";

// One page per county, built the first time someone opens it, then kept for a week.
export const revalidate = 604800;

type Props = { params: Promise<{ county: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county } = await params;
  const d = await countyData(county);
  if (!d) return {};
  const place = `${d.county.name}, ${d.county.st}`;
  return pageMeta(
    `/tornado-database/${county}`,
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
  const [{ disabled }, colors, d] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    countyData(county),
  ]);
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">
      {disabled.includes("tornado-database") ? (
        <ModuleOff label="Tornado Database" />
      ) : (
        <CountyPage d={d} colors={colors} />
      )}
    </main>
  );
}
