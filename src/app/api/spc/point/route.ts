import { stepsAt } from "@/lib/colors/spc-server";

/** GET /api/spc/point?lat=&lon= → the probability step (0–5) at one place for Days 1–8. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  return Response.json(
    { days: await stepsAt(lat, lon) },
    { headers: { "Cache-Control": "public, s-maxage=600" } },
  );
}
