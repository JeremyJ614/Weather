import { getColors } from "@/lib/colors/server";
import { cpcHazards, droughtAlbers, droughtNow } from "@/lib/hazards/data";

/**
 * GET /api/hazards/map?layer=cpc|usdm → colored GeoJSON for the Hazards & Droughts maps;
 * ?layer=usdm&shape=albers → the Drought Monitor as paths for the national map.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const layer = q.get("layer");
  if (layer === "usdm" && q.get("shape") === "albers")
    try {
      return Response.json(await droughtAlbers(await getColors()), {
        headers: {
          "Cache-Control":
            "public, s-maxage=21600, stale-while-revalidate=3600",
        },
      });
    } catch {
      return Response.json(
        { error: "The Drought Monitor isn't answering right now." },
        { status: 502 },
      );
    }
  if (layer !== "cpc" && layer !== "usdm")
    return Response.json({ error: "Unknown layer" }, { status: 400 });
  try {
    const colors = await getColors();
    const geo =
      layer === "cpc"
        ? (await cpcHazards(colors)).geo
        : (await droughtNow(colors)).geo;
    return Response.json(geo, {
      headers: {
        "Cache-Control": `public, s-maxage=${layer === "cpc" ? 1800 : 21600}, stale-while-revalidate=3600`,
      },
    });
  } catch {
    return Response.json(
      { error: "The map service isn't answering right now." },
      { status: 502 },
    );
  }
}
