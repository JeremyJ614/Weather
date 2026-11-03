import { surges } from "@/lib/engines/surge";
import { engineStats } from "@/lib/engines/verify";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

export const maxDuration = 60;

/** Lightning Surge Detector: storms whose lightning is jumping, and the engine's hit rate. */
export async function GET() {
  if (!isLive((await getSiteDefaults()).extras, "surge"))
    return new Response("Not found", { status: 404 });
  try {
    const [d, stats] = await Promise.all([
      surges(),
      engineStats("surge").catch(() => null),
    ]);
    return Response.json(
      {
        at: d.at,
        total: d.total,
        minutes: d.minutes,
        storms: d.storms,
        polys: d.polys,
        stats,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ProbSevere is unavailable" },
      { status: 502 },
    );
  }
}
