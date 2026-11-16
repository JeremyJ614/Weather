import { worldStorms } from "@/lib/tropical/world";

/**
 * GET /api/tropical/world → every JTWC warning in force outside NHC's basins (West
 * Pacific, North Indian Ocean, Southern Hemisphere). Cached for 15 minutes.
 */
export async function GET() {
  const storms = await worldStorms();
  if (!storms)
    return Response.json(
      { error: "The Joint Typhoon Warning Center isn't answering right now." },
      { status: 502 },
    );
  return Response.json(
    { storms, updated: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}
