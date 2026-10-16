import { tornadoTracks } from "@/lib/history/data";

export const maxDuration = 60;

/**
 * GET /api/history/tornadoes?year=2025 or ?days=30|90 → projected tornado tracks.
 * A finished year never changes, so it is cached for a week; recent windows for an hour.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = Number(q.get("year"));
  const days = Number(q.get("days"));
  let start: string;
  let end: string;
  let ttl = 3600;
  if (year >= thisYear - 15 && year <= thisYear) {
    start = `${year}-01-01`;
    end = `${year + 1}-01-01`;
    if (year < thisYear) ttl = 7 * 86400;
  } else if ([7, 30, 90, 365].includes(days)) {
    start = new Date(now.getTime() - days * 86400000)
      .toISOString()
      .slice(0, 10);
    end = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  } else
    return Response.json(
      { error: "Pick a year or a window." },
      { status: 400 },
    );
  try {
    const tracks = await tornadoTracks(start, end, ttl);
    return Response.json(
      { start, end, tracks },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The NWS damage survey service isn't answering right now." },
      { status: 502 },
    );
  }
}
