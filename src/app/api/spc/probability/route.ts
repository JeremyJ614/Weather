import { getColors } from "@/lib/colors/server";
import { probabilityLayer } from "@/lib/colors/spc-server";

/** GET /api/spc/probability?day=1 → VIP's severe probability map for one day. */
export async function GET(request: Request) {
  const day = Number(new URL(request.url).searchParams.get("day"));
  if (!Number.isInteger(day) || day < 1 || day > 8)
    return Response.json({ error: "Unknown day" }, { status: 400 });
  try {
    return Response.json(await probabilityLayer(day, await getColors()), {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "SPC isn't answering right now." },
      { status: 502 },
    );
  }
}
