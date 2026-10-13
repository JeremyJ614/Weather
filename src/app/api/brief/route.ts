import { buildBrief } from "@/lib/brief/build";
import { snap, validCoords } from "@/lib/weather/geo";
import { UpstreamError } from "@/lib/weather/nws";

/** GET /api/brief?lat&lon → today's brief for that place. */
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
    return Response.json(await buildBrief(sLat, sLon), {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=900",
      },
    });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    return Response.json(
      {
        error:
          e instanceof UpstreamError ? e.message : "The brief is unavailable",
      },
      { status },
    );
  }
}
