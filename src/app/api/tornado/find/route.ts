import { find } from "@/lib/tornado/db";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/tornado/find?q=43331 | Joplin MO | Pike County → counties with their tornado counts. */
export async function GET(req: Request) {
  const slow = limited(req, "tornado/find", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return Response.json(
      { hits: await find(q) },
      { headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" } },
    );
  } catch (e) {
    return Response.json(
      {
        hits: [],
        error:
          e instanceof Error && /ZIP/.test(e.message)
            ? e.message
            : "Search is unavailable right now.",
      },
      { status: 200 },
    );
  }
}
