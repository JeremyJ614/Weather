import { fireAlertsAt } from "@/lib/fire/data";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/fire/here?lat=&lon= → Red Flag Warnings and Fire Weather Watches at a place. */
export async function GET(req: Request) {
  const slow = limited(req, "fire/here", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!(lat > 15 && lat < 72 && lon > -180 && lon < -60))
    return Response.json({ error: "Pick a US place." }, { status: 400 });
  return Response.json(
    {
      alerts: await fireAlertsAt(
        Math.round(lat * 100) / 100,
        Math.round(lon * 100) / 100,
      ),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
