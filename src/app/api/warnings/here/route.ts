import { alertsAt } from "@/lib/nws/active";

/** GET /api/warnings/here?lat=&lon= → ids of alerts in effect at one place. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  try {
    return Response.json(
      { ids: await alertsAt(lat, lon) },
      { headers: { "Cache-Control": "public, s-maxage=60" } },
    );
  } catch {
    return Response.json({ ids: [], error: "unavailable" }, { status: 502 });
  }
}
