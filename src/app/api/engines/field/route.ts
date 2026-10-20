import { fieldEngine } from "@/lib/engines/fields";
import type { FieldId } from "@/lib/engines/colors";

export const maxDuration = 60;

const IDS: FieldId[] = ["llj", "snsq", "nst", "pyro", "tctor"];

/** GET ?e=llj|snsq|nst|pyro|tctor: one model-driven engine's map and list, cached 30 min. */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e") as FieldId;
  if (!IDS.includes(e)) return new Response("Bad request", { status: 400 });
  try {
    return Response.json(await fieldEngine(e), {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 502 },
    );
  }
}
