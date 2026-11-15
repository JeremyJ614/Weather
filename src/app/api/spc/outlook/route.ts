import { getColors } from "@/lib/colors/server";
import { outlookLayer } from "@/lib/colors/spc-server";
import type { Hazard } from "@/lib/colors/spc";
import { LIMITS, limited } from "@/lib/ratelimit";

const HAZ = new Set(["cat", "torn", "hail", "wind"]);

/** GET /api/spc/outlook?day=1&hazard=torn&intensity=1 → one outlook map in VIP's palette. */
export async function GET(request: Request) {
  const slow = limited(request, "spc/outlook", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(request.url).searchParams;
  const day = Number(q.get("day"));
  const hazard = q.get("hazard") ?? "cat";
  if (!Number.isInteger(day) || day < 1 || day > 8 || !HAZ.has(hazard))
    return Response.json({ error: "Unknown outlook" }, { status: 400 });
  try {
    const layer = await outlookLayer(
      day,
      hazard as Hazard,
      q.get("intensity") === "1",
      await getColors(),
    );
    return Response.json(layer, {
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
