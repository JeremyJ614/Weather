import { frameTimes, national } from "@/lib/lightning/data";

/** GET /api/lightning/national → frame times, national lightning area and hotspots. */
export async function GET() {
  try {
    const [times, n] = await Promise.all([frameTimes(), national()]);
    return Response.json(
      { times, national: n },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Lightning data unavailable." },
      { status: 502 },
    );
  }
}
