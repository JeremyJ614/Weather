import { rotationTracks } from "@/lib/engines/rotation";

export const maxDuration = 60;

/** MRMS 60-minute rotation tracks, pooled to ~2 km and joined into tracks. */
export async function GET() {
  try {
    return Response.json(await rotationTracks(), {
      headers: {
        "Cache-Control": "public, s-maxage=240, stale-while-revalidate=240",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 502 },
    );
  }
}
