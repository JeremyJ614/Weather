import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { earthNow } from "@/lib/earth/watch";
import { getColors } from "@/lib/colors/server";
import { EarthWatch } from "./EarthWatch";

export const revalidate = 900;
export const metadata: Metadata = pageMeta(
  "/earth-watch",
  "Earth Watch",
  "What's happening on the whole planet right now: tropical cyclones, floods, wildfires, volcanoes, earthquakes, dust and sea ice on a live 3D globe.",
);

/** Earth Watch (post-launch A2, B10): the whole planet's weather and hazards on one globe. */
export default async function EarthWatchPage() {
  const [data, colors] = await Promise.all([
    earthNow().catch(() => null),
    getColors().catch(() => undefined),
  ]);
  return <EarthWatch initial={data} colors={colors} />;
}
