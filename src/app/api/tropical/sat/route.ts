import { satFrames } from "@/lib/tropical/sat";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/tropical/sat?src=AL|EP|CP|<storm id>&big=1 → the newest GeoColor frames. */
export async function GET(req: Request) {
  const slow = limited(req, "tropical/sat", LIMITS.frames);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const data = await satFrames(
    String(q.get("src") ?? "")
      .toUpperCase()
      .slice(0, 12),
    q.get("big") === "1",
  ).catch(() => null);
  return data
    ? Response.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      })
    : Response.json(
        { error: "No satellite frames right now." },
        { status: 502 },
      );
}
