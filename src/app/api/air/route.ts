import { getAir } from "@/lib/air/air";
import { snap, validCoords } from "@/lib/weather/geo";

/** GET /api/air?lat&lon → AQI (now + days) and pollen (counts or dispersal). */
export async function GET(request: Request) {
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
  return Response.json(await getAir(sLat, sLon), {
    headers: {
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=1800",
    },
  });
}
