import { floodHere } from "@/lib/flood/data";

/** GET /api/flood/here?lat=&lon= → excessive-rain levels, rainfall and flood alerts at a place. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!(lat > 15 && lat < 72 && lon > -180 && lon < -60))
    return Response.json({ error: "Pick a US place." }, { status: 400 });
  try {
    return Response.json(
      await floodHere(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100),
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Flood details for this place aren't available right now." },
      { status: 502 },
    );
  }
}
