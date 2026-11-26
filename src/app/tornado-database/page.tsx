import type { Metadata } from "next";
import { Tornado } from "lucide-react";
import { pageMeta } from "@/lib/seo/site";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { stateBoxes } from "@/lib/history/states";
import { counties } from "@/lib/tornado/db";
import { TornadoHome } from "./Home";

export const metadata: Metadata = pageMeta(
  "/tornado-database",
  "Tornado Database",
  "Has a tornado ever hit your town? Every tornado path in every US county since 1950, when the season peaks, the record years and your region's paths from the last two years.",
);
export const revalidate = 86400;

// Census divisions: the map frames the whole division around the saved place's state.
const DIVISIONS = [
  "ME NH VT MA RI CT",
  "NY NJ PA",
  "OH IN IL MI WI",
  "MN IA MO ND SD NE KS",
  "DE MD DC VA WV NC SC GA FL",
  "KY TN AL MS",
  "AR LA OK TX",
  "MT ID WY CO NM AZ UT NV",
  "WA OR CA",
  "AK",
  "HI",
].map((d) => d.split(" "));
const FAMOUS = [
  "oklahoma-county-ok",
  "cleveland-county-ok",
  "jasper-county-mo",
  "tuscaloosa-county-al",
  "graves-county-ky",
  "sharkey-county-ms",
  "kiowa-county-ks",
  "harris-county-tx",
  "jefferson-county-al",
];

export default async function TornadoDatabase() {
  const [{ disabled }, colors, idx] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    counties(),
  ]);
  const boxes = stateBoxes();
  const views: Record<string, { x: number; y: number; w: number }> = {};
  for (const div of DIVISIONS) {
    const bs = div.map((st) => boxes[st]).filter(Boolean);
    if (!bs.length) continue;
    const x0 = Math.min(...bs.map((b) => b[0])),
      y0 = Math.min(...bs.map((b) => b[1])),
      x1 = Math.max(...bs.map((b) => b[2])),
      y1 = Math.max(...bs.map((b) => b[3]));
    // The canvas is 975×610: widen to that shape with a margin, so the division sits centred.
    const pad = 18;
    let w = x1 - x0 + pad * 2;
    let h = y1 - y0 + pad * 2;
    if (w / h < 975 / 610) w = (h * 975) / 610;
    else h = (w * 610) / 975;
    const v = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w };
    for (const st of div) views[st] = v;
  }
  const famous = FAMOUS.map((slug) => idx.bySlug.get(slug))
    .filter((c) => !!c)
    .map((c) => ({
      slug: c.slug,
      label: `${c.name}, ${c.st}`,
      n: c.n,
      top: c.top,
    }));
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Tornado aria-hidden />}
        eyebrow={["NOAA SPC", "1950 to " + idx.through, "3,235 counties"]}
        title="Tornado Database"
        subtitle="Has a tornado ever hit your town? Every path in every county since 1950, and your region's last two years on the map."
      />
      {disabled.includes("tornado-database") ? (
        <ModuleOff label="Tornado Database" />
      ) : (
        <TornadoHome
          colors={colors}
          views={views}
          famous={famous}
          year={new Date().getUTCFullYear()}
        />
      )}
    </main>
  );
}
