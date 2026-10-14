import { getColors } from "@/lib/colors/server";
import { geoPath, type Geometry } from "@/lib/map/geo";
import { getOutlook } from "@/lib/tropical/nhc";
import { tierOf } from "@/lib/tropical/style";

/** GET /api/tropical/preview → today's tropical picture for the color editor's US preview. */
export async function GET() {
  try {
    const o = await getOutlook(await getColors());
    const polys = [...o.geo.areas.features, ...o.geo.cones.features]
      .map((f) => ({
        c: String(f.properties?.color ?? "#888888"),
        d: geoPath(f.geometry as Geometry),
      }))
      .filter((p) => p.d);
    const dots = o.storms.flatMap((x) =>
      x.points.map((p) => ({
        lon: p.lon,
        lat: p.lat,
        key: `trop:${tierOf(p.kt).key}`,
      })),
    );
    return Response.json(
      { polys, dots },
      { headers: { "Cache-Control": "public, s-maxage=600" } },
    );
  } catch {
    return Response.json(
      { error: "NHC isn't answering right now." },
      { status: 502 },
    );
  }
}
