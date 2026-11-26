import { skyGrid } from "@/lib/sky/grid";

/**
 * GET /api/sky/grid → stargazing scores on the national lattice (see lib/sky/grid). When
 * Open-Meteo won't give the server a current forecast (it rate-limits Vercel's shared
 * addresses), the answer is an empty grid cached for 15 minutes: the page then fetches the
 * forecast in the viewer's browser, and the server doesn't spend more calls retrying.
 */
export async function GET() {
  try {
    return Response.json(await skyGrid(), {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch {
    return Response.json(
      {
        lats: [],
        lons: [],
        t0: "",
        scores: [],
        tonight: [],
        tomorrow: [],
        unavailable: true,
      },
      { headers: { "Cache-Control": "public, s-maxage=900" } },
    );
  }
}
