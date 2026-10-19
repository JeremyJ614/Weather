import { probSevere } from "@/lib/engines/probsevere";

/** ProbTor and ProbHail from the newest ProbSevere file (Extras → Weather Engines). */
export async function GET() {
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
