import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { earthNow } from "@/lib/earth/watch";
import { getColors } from "@/lib/colors/server";
import { MODELS, rampColors } from "@/lib/models/render";
import type { Param } from "@/lib/models/params";
import { WIND } from "@/lib/earth/wind";
import { EarthWatch } from "./EarthWatch";

export const revalidate = 300;
export const metadata: Metadata = pageMeta(
  "/earth-watch",
  "Earth Watch",
  "What's happening on the whole planet right now: tropical cyclones, floods, wildfires, volcanoes and earthquakes with live clouds, radar, wind, rain, snow and ocean temperature on a 3D globe.",
);

/** Earth Watch (post-launch A2, B10): the whole planet's weather and hazards on one globe. */
export default async function EarthWatchPage() {
  const [data, colors] = await Promise.all([
    earthNow().catch(() => null),
    getColors().catch(() => undefined),
  ]);
  // The wind's colors: the model viewer's wind scale, editable in admin → Map & data colors.
  const windRamp = rampColors({ ...WIND, cmap: "wind" } as Param, colors ?? {});
  return (
    <EarthWatch
      initial={data}
      colors={colors}
      wind={{ tpl: MODELS.gfs.tpl!, ramp: windRamp }}
    />
  );
}
