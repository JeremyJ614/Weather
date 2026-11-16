import { earthNow } from "@/lib/earth/watch";

/** Earth Watch's events (B10), cached at the edge for 15 minutes. */
export const revalidate = 900;

export async function GET() {
  try {
    return Response.json(await earthNow(), {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "The global feeds aren't answering right now." },
      { status: 502 },
    );
  }
}
