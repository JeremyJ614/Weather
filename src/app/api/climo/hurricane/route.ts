import {
  hurricaneNear,
  hurricaneSummary,
  majorTracks,
} from "@/lib/climo/server";

/** GET /api/climo/hurricane → national hurricane climatology; with ?lat=&lon= → within 60 miles of a place; ?tracks → major-hurricane tracks. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const headers = {
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  };
  if (q.has("tracks")) return Response.json(majorTracks(), { headers });
  if (!q.has("lat")) return Response.json(hurricaneSummary(), { headers });
  const lat = Math.round(Number(q.get("lat")) * 100) / 100;
  const lon = Math.round(Number(q.get("lon")) * 100) / 100;
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180))
    return Response.json({ error: "Pick a place." }, { status: 400 });
  return Response.json(hurricaneNear(lat, lon), { headers });
}
