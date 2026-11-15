import { snap, validCoords } from "@/lib/weather/geo";
import { getConditions } from "@/lib/weather/conditions";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/conditions?lat&lon → latest observation, pressure trend, SPC Day 1 risk, UV. */
export async function GET(request: Request) {
  const slow = limited(request, "conditions", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!q.get("lat") || !q.get("lon") || !validCoords(lat, lon)) {
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  }
  const [sLat, sLon] = snap(lat, lon);
  return Response.json(await getConditions(sLat, sLon), {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
