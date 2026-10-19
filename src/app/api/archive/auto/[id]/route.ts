import { discoverForRoute } from "@/features/replay/import/sources";
import { eventFromBundle } from "@/features/replay/archive/fromBundle";

export const maxDuration = 60;

/**
 * One automatic Tornado Archive day, built on request from the NWS survey (tracks, damage
 * points and contours), IEM's storm reports (names, hail) and IEM's warning archive. Nothing
 * of it is stored: the CDN keeps it a day, and a revised survey shows up the day after.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,40}$/.test(id))
    return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("Not configured", { status: 503 });
  const r = await fetch(
    `${url}/rest/v1/archive_auto?select=id,name,region,tz,t0,t1,west,south,east,north&id=eq.${id}`,
    { headers: { apikey: key }, cache: "no-store" },
  );
  const [row] = r.ok
    ? ((await r.json()) as {
        id: string;
        name: string;
        region: string;
        tz: string;
        t0: number;
        t1: number;
        west: number;
        south: number;
        east: number;
        north: number;
      }[])
    : [];
  if (!row) return new Response("Not found", { status: 404 });
  try {
    const bundle = await discoverForRoute(
      [
        [row.t0, row.south, row.west],
        [row.t1, row.north, row.east],
      ],
      row.tz,
      { padDeg: 0.3, padHours: 1, signal: AbortSignal.timeout(50_000) },
    );
    return Response.json(eventFromBundle(row, bundle), {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 502 },
    );
  }
}
