import { warningMap } from "@/lib/warnings/feed";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/warnings/map → the national warnings map layer ({ polys, legend }); ?only=flood → flood products only. */
export async function GET(req: Request) {
  const slow = limited(req, "warnings/map", LIMITS.normal);
  if (slow) return slow;
  const only =
    new URL(req.url).searchParams.get("only") === "flood" ? "flood" : undefined;
  try {
    return Response.json(await warningMap(only), {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json(
      { error: "NOAA's warning map service isn't answering right now." },
      { status: 502 },
    );
  }
}
