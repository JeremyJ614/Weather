import { stormReports } from "@/lib/warnings/feed";
import { LIMITS, limited } from "@/lib/ratelimit";

const HOURS = new Set([6, 12, 24, 48]);

/** GET /api/reports?hours=24 → IEM Local Storm Reports, newest first. */
export async function GET(request: Request) {
  const slow = limited(request, "reports", LIMITS.normal);
  if (slow) return slow;
  const h = Number(new URL(request.url).searchParams.get("hours") ?? 24);
  if (!HOURS.has(h))
    return Response.json(
      { error: "hours must be 6, 12, 24 or 48" },
      { status: 400 },
    );
  try {
    return Response.json(
      { hours: h, reports: await stormReports(h) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The storm report feed isn't answering right now." },
      { status: 502 },
    );
  }
}
