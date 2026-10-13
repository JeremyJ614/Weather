import { nationalScore } from "@/lib/sswxcon/live";

/** GET /api/sswxcon → the national score now (edge-cached two minutes). */
export async function GET() {
  try {
    return Response.json(await nationalScore(), {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "The National Weather Service alert feed isn't answering right now.",
      },
      { status: 502 },
    );
  }
}
