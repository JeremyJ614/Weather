import { warningHistory } from "@/lib/history/data";

export const maxDuration = 60;

/** GET /api/history/warnings?days=1|3|7|30 → projected TO/SV/FF warning polygons. */
export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days"));
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
