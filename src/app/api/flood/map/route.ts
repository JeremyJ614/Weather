import { getColors } from "@/lib/colors/server";
import { eroMap } from "@/lib/flood/data";

/** GET /api/flood/map?day=1..5 → that day's Excessive Rainfall Outlook as colored GeoJSON. */
export async function GET(req: Request) {
  const day = Number(new URL(req.url).searchParams.get("day"));
  if (![1, 2, 3, 4, 5].includes(day))
    return Response.json({ error: "Pick a day." }, { status: 400 });
  try {
    return Response.json(await eroMap(day, await getColors()), {
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
