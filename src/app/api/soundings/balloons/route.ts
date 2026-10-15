import { balloons } from "@/lib/soundings/data";

/** GET /api/soundings/balloons → the newest launch time and the stations that launched. */
export async function GET() {
  try {
    const b = await balloons();
    if (!b)
      return Response.json({ error: "No recent launches." }, { status: 404 });
    return Response.json(b, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "Balloon data unavailable." },
      { status: 502 },
    );
  }
}
