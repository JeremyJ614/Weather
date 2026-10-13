import { PLACES } from "@/lib/geo/places.data";
import { parsePlaces, searchPlaces } from "@/lib/geo/search";

let rows: ReturnType<typeof parsePlaces> | null = null;

/** GET /api/geo/search?q=dayton oh → up to 8 US places, best match first. */
export function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  rows ??= parsePlaces(PLACES);
  return Response.json(
    { places: searchPlaces(rows, q) },
    { headers: { "Cache-Control": "public, s-maxage=2592000, max-age=86400" } },
  );
}
