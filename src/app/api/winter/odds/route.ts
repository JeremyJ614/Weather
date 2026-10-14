import { getColors } from "@/lib/colors/server";
import { probMap } from "@/lib/winter/data";
import { PROB_KINDS, type ProbKind } from "@/lib/winter/style";

/** GET /api/winter/odds?day=1..3&kind=snow4|snow8|snow12|ice → WPC odds as colored GeoJSON. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const day = Number(q.get("day"));
  const kind = q.get("kind") as ProbKind;
  if (![1, 2, 3].includes(day) || !(kind in PROB_KINDS))
    return Response.json({ error: "Pick a day and amount." }, { status: 400 });
  try {
    return Response.json(await probMap(day, kind, await getColors()), {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch {
    return Response.json(
      { error: "WPC's map service isn't answering right now." },
      { status: 502 },
    );
  }
}
