import { getColors } from "@/lib/colors/server";
import { SPC_PALETTES } from "@/lib/colors/spc";
import { spcFeatures } from "@/lib/colors/spc-server";
import { geoPath } from "@/lib/map/geo";
import { colorFor } from "@/lib/map/products";
import states from "@/lib/map/data/usStatesAlbers.json";
import { OG_SIZE, OG_TYPE, ogCard, svgImg } from "@/lib/seo/og";

export const alt = "Today's SPC severe weather outlook on a U.S. map";
export const size = OG_SIZE;
export const contentType = OG_TYPE;
// Today's map: redrawn every half hour.
export const revalidate = 1800;

const ORDER = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

/** The share image is today's Day 1 outlook itself, so a shared link shows the risk. */
export default async function Image() {
  const [feats, colors] = await Promise.all([
    spcFeatures("outlook/day1otlk_cat").catch(() => []),
    getColors(),
  ]);
  const areas = feats
    .map((f) => ({
      d: geoPath(f.geometry, 0.8),
      c: colorFor("spcCat", f.properties ?? {}, colors),
    }))
    .filter((a) => a.d && a.c);
  const top = feats
    .map((f) => ORDER.indexOf(String(f.properties?.LABEL)))
    .reduce((a, b) => Math.max(a, b), -1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 975 610"><g fill="#13141f" stroke="#3a3d55" stroke-width="1">${(states as { states: { d: string }[] }).states.map((s) => `<path d="${s.d}"/>`).join("")}</g>${areas.map((a) => `<path d="${a.d}" fill="${a.c}" fill-opacity="0.8" stroke="${a.c}" stroke-width="2"/>`).join("")}<g fill="none" stroke="#5a5e7a" stroke-width="0.8">${(states as { states: { d: string }[] }).states.map((s) => `<path d="${s.d}"/>`).join("")}</g></svg>`;
  return ogCard({
    eyebrow: "SPC outlook · Day 1",
    title: "Today's severe weather risk",
    sub:
      top > 0
        ? `Highest risk: ${SPC_PALETTES.cat[top].label}.`
        : top === 0
          ? "General thunderstorms only."
          : "No thunderstorms outlined today.",
    art: svgImg(svg, 600, 375),
  });
}
