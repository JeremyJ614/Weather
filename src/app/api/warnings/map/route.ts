import { warningMap } from "@/lib/warnings/feed";

/** GET /api/warnings/map → the national warnings map layer ({ polys, legend }). */
export async function GET() {
  try {
    return Response.json(await warningMap(), {
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
