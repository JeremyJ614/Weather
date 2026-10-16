import { ovation, SECTOR } from "@/lib/aurora/data";
import { AURORA_RAMP } from "@/lib/aurora/style";

/** GET /api/aurora/preview → the current oval over the US as dots, for admin → Map & data colors. */
export async function GET() {
  try {
    const o = await ovation();
    const dots: { lat: number; lon: number; key: string }[] = [];
    for (let y = 0; y < o.h; y += 1)
      for (let x = 0; x < o.w; x += 2) {
        const v = o.grid[y * o.w + x];
        const band = [...AURORA_RAMP].reverse().find((b) => v >= b.at);
        if (band)
          dots.push({
            lat: SECTOR.lat0 + y,
            lon: SECTOR.lon0 + x,
            key: `aurora:${band.key}`,
          });
      }
    return Response.json(
      { dots },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch {
    return Response.json({ error: "SWPC isn't answering." }, { status: 502 });
  }
}
