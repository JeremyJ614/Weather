import { probSevere } from "@/lib/engines/probsevere";
import { stateOf } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

/** ProbTor from the newest ProbSevere file (Extras → Weather Engines). */
export async function GET() {
  const { extras } = await getSiteDefaults();
  // ProbTor switched off or hidden in admin → Extras.
  if (stateOf(extras, "tor") !== "on")
    return new Response("Not found", { status: 404 });
  try {
    return Response.json(await probSevere(), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ProbSevere is unavailable" },
      { status: 502 },
    );
  }
}
