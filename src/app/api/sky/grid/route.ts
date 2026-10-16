import { skyGrid } from "@/lib/sky/grid";

/** GET /api/sky/grid → stargazing scores on the national lattice (see lib/sky/grid). */
export async function GET() {
  try {
    return Response.json(await skyGrid(), {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch {
    return Response.json(
      { error: "Sky forecast unavailable." },
      { status: 502 },
    );
  }
}
