import { monthDone, warningHistory, warningMonth } from "@/lib/history/data";
import { LIMITS, limited } from "@/lib/ratelimit";

export const maxDuration = 60;

/**
 * GET /api/history/warnings?days=1|3|7|30 → projected TO/SV/FF warning polygons.
 * GET ?month=YYYY-MM → one month (2008 on), for windows past 30 days: the page asks for each
 * month it needs. A finished month never changes, so it is held at the edge for a week.
 */
export async function GET(req: Request) {
  const slow = limited(req, "history/warnings", LIMITS.heavy);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const month = q.get("month");
  if (month) {
    const now = new Date().toISOString().slice(0, 7);
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month < "2008-01" ||
      month > now
    )
      return Response.json({ error: "Pick a month." }, { status: 400 });
    try {
      const polys = await warningMonth(month);
      const ttl = monthDone(month) ? 7 * 86400 : 1800;
      return Response.json(
        { month, polys },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
          },
        },
      );
    } catch {
      return Response.json(
        { error: "The warning archive isn't answering right now." },
        { status: 502 },
      );
    }
  }
  const days = Number(q.get("days"));
  if (![1, 3, 7, 30].includes(days))
    return Response.json({ error: "Pick a window." }, { status: 400 });
  // Round to the hour so everyone in the same hour shares one cached answer.
  const end = new Date(Math.floor(Date.now() / 3600000) * 3600000);
  const start = new Date(end.getTime() - days * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 16) + "Z";
  try {
    const polys = await warningHistory(iso(start), iso(end));
    return Response.json(
      { start: iso(start), end: iso(end), polys },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The warning archive isn't answering right now." },
      { status: 502 },
    );
  }
}
