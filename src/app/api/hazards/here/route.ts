import { hazardsHere } from "@/lib/hazards/data";

/** GET /api/hazards/here?lat=&lon= → drought category, state drought and hazards at a place. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!(lat > 15 && lat < 72 && lon > -180 && lon < -60))
    return Response.json({ error: "Pick a US place." }, { status: 400 });
  try {
    return Response.json(
      await hazardsHere(
        Math.round(lat * 100) / 100,
        Math.round(lon * 100) / 100,
      ),
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Hazards for this place aren't available right now." },
      { status: 502 },
    );
  }
}
