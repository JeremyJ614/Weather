import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";

let rows: ReturnType<typeof parsePlaces> | null = null;

/** GET /api/geo/near?lat=&lon= → { label } such as "8 mi from Wichita Falls, TX". */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  rows ??= parsePlaces(PLACES);
  const n = nearestPlace(rows, lat, lon);
  if (!n) return Response.json({ label: null });
  const name = `${n.hit.name}, ${n.hit.st}`;
  const mi = Math.round(n.miles);
  return Response.json(
    { label: mi < 5 ? name : `${mi} mi from ${name}` },
    { headers: { "Cache-Control": "public, s-maxage=2592000" } },
  );
}
