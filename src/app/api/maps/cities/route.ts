import { PLACES } from "@/lib/geo/places.data";
import { parsePlaces } from "@/lib/geo/search";
import { project } from "@/lib/map/usAlbers";

export const revalidate = 86400;

/** GET /api/maps/cities → the 3,000 largest places as [name, x, y] in map canvas coordinates, biggest first. */
export function GET() {
  const rows = parsePlaces(PLACES)
    .sort((a, b) => b.pop - a.pop)
    .slice(0, 3000)
    .map((p) => {
      const { x, y } = project(p.lon, p.lat);
      return [p.name, Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    });
  return Response.json(rows, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}
