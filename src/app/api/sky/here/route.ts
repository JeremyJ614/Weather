import { skyHourly } from "@/lib/sky/grid";

/** GET /api/sky/here?lat=&lon= → hourly sky inputs (UTC) for one place, 3 days. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Math.round(Number(q.get("lat")) * 100) / 100;
  const lon = Math.round(Number(q.get("lon")) * 100) / 100;
  if (
    !(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) ||
    !q.get("lat") ||
    !q.get("lon")
  )
    return Response.json({ error: "Pick a place." }, { status: 400 });
  try {
    const [hourly] = await skyHourly([lat], [lon], 3600);
    return Response.json(
      { hourly },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Sky forecast unavailable." },
      { status: 502 },
    );
  }
}
