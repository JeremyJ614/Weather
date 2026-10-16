import { warningMap } from "@/lib/warnings/feed";

/** GET /api/warnings/map → the national warnings map layer ({ polys, legend }); ?only=flood → flood products only. */
export async function GET(req: Request) {
  const only =
    new URL(req.url).searchParams.get("only") === "flood" ? "flood" : undefined;
  try {
    return Response.json(await warningMap(only), {
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
