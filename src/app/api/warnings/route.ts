import { warningsList } from "@/lib/warnings/feed";

/** GET /api/warnings → every active land alert, most dangerous first (cached a minute). */
export async function GET() {
  try {
    return Response.json(await warningsList(), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
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
