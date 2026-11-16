import { earthNow } from "@/lib/earth/watch";

/** Earth Watch's events (B10), cached at the edge for 5 minutes. */
export const revalidate = 300;

export async function GET() {
  try {
    return Response.json(await earthNow(), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json(
      { error: "The global feeds aren't answering right now." },
      { status: 502 },
    );
  }
}
