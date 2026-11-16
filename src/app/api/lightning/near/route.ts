import { near } from "@/lib/lightning/data";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/lightning/near?lat=&lon= → lightning around a place over the last hour. */
export async function GET(req: Request) {
  const slow = limited(req, "lightning/near", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const lat = Math.round(Number(q.get("lat")) * 100) / 100;
  const lon = Math.round(Number(q.get("lon")) * 100) / 100;
  if (!(lat > -25 && lat < 78 && lon > -179 && lon < 0))
    return Response.json(
      { error: "Pick a place in the Americas." },
      { status: 400 },
    );
  try {
    const d = await near(lat, lon);
    if (!d) return Response.json({ error: "No frames." }, { status: 502 });
    return Response.json(d, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json(
      { error: "Lightning data unavailable." },
      { status: 502 },
    );
  }
}
