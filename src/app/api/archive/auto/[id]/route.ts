import { discoverForRoute } from "@/features/replay/import/sources";
import { eventFromBundle } from "@/features/replay/archive/fromBundle";
import type { ArchiveEvent } from "@/features/replay/archive/types";
import { SPC_THROUGH, scaleOf, spcEvent } from "@/lib/archive/spc";

const CACHE = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
  return Math.hypot(x, (b[1] - a[1]) * r) * 6371;
};

/**
 * A day before 2023, from SPC's database (lib/archive/spc.ts). From 2003 the NWS survey, storm
 * reports and warnings are asked for too: a tornado the survey has is drawn on its surveyed
 * path; the rest stay straight lines from their recorded start to end.
 */
async function spcDay(id: string): Promise<Response> {
  const ev = spcEvent(id);
  if (!ev) return new Response("Not found", { status: 404 });
  const { day, torn } = ev;
  const bundle =
    day.day >= "2003-01-01"
      ? await discoverForRoute(
          [
            [day.t0, day.south, day.west],
            [day.t1, day.north, day.east],
          ],
          day.tz,
          { padDeg: 0.3, padHours: 1, signal: AbortSignal.timeout(45_000) },
        ).catch(() => null)
      : null;
  const surveyed = bundle ? eventFromBundle(day, bundle).torn : [];
  const event: ArchiveEvent = {
    id: day.id,
    name: day.name,
    region: day.region,
    blurb: "",
    scale: scaleOf(day.day),
    tz: day.tz,
    T0: day.t0,
    source: `NOAA Storm Prediction Center tornado database${surveyed.length ? ", with NWS damage surveys" : ""}`,
    pathFidelity:
      "straight lines from each tornado's recorded start to its end, or the surveyed path where the NWS survey has one",
    torn: torn.map(
      (t) =>
        surveyed.find(
          (s) =>
            Math.abs(s.start - t.start) <= 1800 &&
            km(s.coords[0], t.coords[0]) <= 15,
        ) ?? t,
    ),
    ...(bundle
      ? {
          polys: bundle.contours,
          dpts: bundle.damage,
          hail: bundle.hail,
          warns: bundle.warnings,
        }
      : {}),
  };
  return Response.json(event, { headers: CACHE });
}

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
  if (id.slice(0, 10) <= SPC_THROUGH) return spcDay(id);
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
    return Response.json(eventFromBundle(row, bundle), { headers: CACHE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 502 },
    );
  }
}
