import { OVERLAYS } from "@/lib/winter/data";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/winter/img?id=…[&h=24|48|72] → one winter overlay image (WPC sends no CORS headers for maps). */
export async function GET(req: Request) {
  const slow = limited(req, "winter/img", LIMITS.frames);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const o = OVERLAYS[q.get("id") ?? ""];
  if (!o) return new Response("Unknown overlay", { status: 400 });
  const h = Number(q.get("h"));
  const url = h && o.at && o.hours?.includes(h) ? o.at(h) : o.url;
  try {
    const r = await fetch(url, {
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
