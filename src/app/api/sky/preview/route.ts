import { skyGrid } from "@/lib/sky/grid";
import { bandOf } from "@/lib/sky/score";

/** GET /api/sky/preview → tonight's grid as colored dots for admin → Map & data colors. */
export async function GET() {
  try {
    const g = await skyGrid();
    const dots = g.lats.flatMap((lat, i) =>
      g.lons.flatMap((lon, j) => {
        const v = g.tonight[i * g.lons.length + j];
        return v == null ? [] : [{ lat, lon, key: `sky:${bandOf(v).key}` }];
      }),
    );
    return Response.json(
      { dots },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  } catch {
    return Response.json(
      { error: "Sky forecast unavailable." },
      { status: 502 },
    );
  }
}
