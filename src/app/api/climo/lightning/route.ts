import { lightningAt } from "@/lib/climo/lis";
import GRID from "@/lib/climo/lightning.json";
import { LIMITS, limited } from "@/lib/ratelimit";

/**
 * GET /api/climo/lightning?lat=&lon= → LIS flash-rate climatology at a place (annual and by
 * month); ?grid → the national LIS/OTD grid (kept off the page bundle).
 */
export async function GET(req: Request) {
  const slow = limited(req, "climo/lightning", LIMITS.heavy);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  if (q.has("grid"))
    return Response.json(GRID, {
      headers: { "Cache-Control": "public, s-maxage=2592000, immutable" },
    });
  const lat = Math.round(Number(q.get("lat")) * 100) / 100;
  const lon = Math.round(Number(q.get("lon")) * 100) / 100;
  if (!q.get("lat") || !(Math.abs(lat) <= 85 && Math.abs(lon) <= 180))
    return Response.json({ error: "Pick a place." }, { status: 400 });
  try {
    return Response.json(await lightningAt(lat, lon), {
      headers: { "Cache-Control": "public, s-maxage=2592000" },
    });
  } catch {
    return Response.json(
      { error: "NASA GIBS isn't answering." },
      { status: 502 },
    );
  }
}
