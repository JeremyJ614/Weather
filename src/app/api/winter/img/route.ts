import { OVERLAYS } from "@/lib/winter/data";

/** GET /api/winter/img?id=… → one winter overlay image (WPC sends no CORS headers for maps). */
export async function GET(req: Request) {
  const o = OVERLAYS[new URL(req.url).searchParams.get("id") ?? ""];
  if (!o) return new Response("Unknown overlay", { status: 400 });
  try {
    const r = await fetch(o.url, {
      headers: {
        "User-Agent": "StormSync Weather (https://weather.sswx.space)",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok || !r.headers.get("content-type")?.startsWith("image/"))
      throw new Error("image");
    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
}
