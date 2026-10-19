import { isRotWindow, rotationTracks } from "@/lib/engines/rotation";

export const maxDuration = 60;

/** MRMS rotation tracks over `?w=` minutes (60 to 1440), pooled to ~2 km and joined into tracks. */
export async function GET(req: Request) {
  const w = Number(new URL(req.url).searchParams.get("w") ?? 60);
  if (!isRotWindow(w))
    return Response.json({ error: "unknown window" }, { status: 400 });
  try {
    return Response.json(await rotationTracks(w), {
      headers: {
        "Cache-Control": `public, s-maxage=${w > 60 ? 600 : 240}, stale-while-revalidate=240`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 502 },
    );
  }
}
