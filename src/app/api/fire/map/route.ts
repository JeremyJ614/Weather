import { getColors } from "@/lib/colors/server";
import {
  activeFires,
  fireOutlook,
  firePoints,
  perimeters,
} from "@/lib/fire/data";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/fire/map?layer=fires|perimeters|day1|day2 → colored GeoJSON for Fire Weather. */
export async function GET(req: Request) {
  const slow = limited(req, "fire/map", LIMITS.normal);
  if (slow) return slow;
  const layer = new URL(req.url).searchParams.get("layer");
  try {
    const colors = await getColors();
    const geo =
      layer === "fires"
        ? firePoints(await activeFires(), colors)
        : layer === "perimeters"
          ? await perimeters()
          : layer === "day1" || layer === "day2"
            ? (await fireOutlook(layer === "day1" ? 1 : 2, colors)).geo
            : null;
    if (!geo) return Response.json({ error: "Unknown layer" }, { status: 400 });
    return Response.json(geo, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "The fire map service isn't answering right now." },
      { status: 502 },
    );
  }
}
