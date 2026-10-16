import { nearby } from "@/lib/rivers/data";

/** GET /api/rivers/near?lat=&lon= → the river gauges nearest a place. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!(lat > 15 && lat < 72 && lon > -180 && lon < -60))
    return Response.json({ error: "Pick a US place." }, { status: 400 });
  try {
    return Response.json(
      {
        gauges: await nearby(
          Math.round(lat * 100) / 100,
          Math.round(lon * 100) / 100,
        ),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The river gauge service isn't answering right now." },
      { status: 502 },
    );
  }
}
