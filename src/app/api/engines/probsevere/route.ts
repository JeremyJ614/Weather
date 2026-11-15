import { probSevere } from "@/lib/engines/probsevere";
import { engineStats, logFlags } from "@/lib/engines/verify";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

/** ProbTor from the newest ProbSevere file (Extras → Weather Engines). */
export async function GET() {
  const { extras } = await getSiteDefaults();
  // ProbTor switched off or hidden in admin → Extras.
  if (!isLive(extras, "tor")) return new Response("Not found", { status: 404 });
  try {
    const [d, stats] = await Promise.all([
      probSevere(),
      engineStats("tor").catch(() => null),
    ]);
    // Storms ProbTor gives 40%+ in the next 20 minutes are checked against tornado reports
    // (post-launch A1 "skill-scores"): one flag per storm per hour.
    await logFlags(
      "tor",
      d.storms
        .filter((x) => x.p20 >= 40)
        .map((x) => ({
          key: `${x.id}:${d.at.slice(0, 13)}`,
          at: Date.parse(d.at),
          lat: x.lat,
          lon: x.lon,
          label: `${x.place} (ProbTor ${x.p20}%)`,
          window_min: 45,
          radius_km: 25,
        })),
    ).catch(() => {});
    return Response.json(
      { ...d, stats },
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
