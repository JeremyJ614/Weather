import { rainbowNow } from "@/lib/engines/rainbow";
import { reportSummary } from "@/lib/engines/reports";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

export const maxDuration = 60;

/** Rainbow Chance: now, +30 and +60 minutes, and what members have reported. */
export async function GET() {
  if (!isLive((await getSiteDefaults()).extras, "rainbow"))
    return new Response("Not found", { status: 404 });
  try {
    const [d, reports] = await Promise.all([
      rainbowNow(),
      reportSummary("rainbow").catch(() => null),
    ]);
    return Response.json(
      { at: d.at, maps: d.maps, spots: d.spots, lowSun: d.lowSun, reports },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error ? e.message : "Radar or satellite is unavailable",
      },
      { status: 502 },
    );
  }
}
