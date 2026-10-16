import { lightningAt } from "@/lib/climo/lis";

/** GET /api/climo/lightning?lat=&lon= → LIS flash-rate climatology at a place (annual and by month). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
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
