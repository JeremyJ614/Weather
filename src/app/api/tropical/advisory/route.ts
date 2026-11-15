import { LIMITS, limited } from "@/lib/ratelimit";
/**
 * GET /api/tropical/advisory?url=https://www.nhc.noaa.gov/text/MIATCPAT1.shtml → the
 * product's text, verbatim. Only NHC text pages are read; cached for 10 minutes.
 */
export async function GET(req: Request) {
  const slow = limited(req, "tropical/advisory", LIMITS.normal);
  if (slow) return slow;
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Response.json({ error: "Pick a product." }, { status: 400 });
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.nhc.noaa.gov" ||
    !/^\/text\/[\w./-]+$/.test(url.pathname)
  )
    return Response.json({ error: "Pick a product." }, { status: 400 });
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(String(res.status));
    const html = await res.text();
    const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html)?.[1] ?? "";
    const text = pre
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    return Response.json(
      { text, url: url.toString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The National Hurricane Center isn't answering right now." },
      { status: 502 },
    );
  }
}
