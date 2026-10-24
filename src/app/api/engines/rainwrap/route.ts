import { wrapStorms } from "@/lib/engines/probsevere";
import { stateOf } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

/** Rain-Wrap Index, live: the rotating storms ProbSevere is tracking and how hidden in rain. */
export async function GET() {
  if (stateOf((await getSiteDefaults()).extras, "rwrap") !== "on")
    return new Response("Not found", { status: 404 });
  try {
    return Response.json(await wrapStorms(), {
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
