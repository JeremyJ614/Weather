import { snap, validCoords } from "@/lib/weather/geo";
import { UpstreamError, getWeather } from "@/lib/weather/nws";

/** GET /api/weather?lat=..&lon=.. → WeatherBundle. Cached at the edge per grid cell. */
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
  try {
    const bundle = await getWeather(sLat, sLon);
    return Response.json(bundle, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    const message =
      e instanceof UpstreamError ? e.message : "Weather data is unavailable";
    return Response.json({ error: message }, { status });
  }
}
