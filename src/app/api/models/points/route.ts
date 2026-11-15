import {
  MODELS,
  cityValues,
  fieldFor,
  paramOf,
  type ModelId,
} from "@/lib/models/render";
import { LIMITS, limited } from "@/lib/ratelimit";

export const maxDuration = 30;

/**
 * GET /api/models/points?model=&cycle=&fh=&p= → the field's value at each city in
 * MODEL_CITIES (same order; see `cityValues`). The viewer now gets them with each frame
 * (/api/models/map's X-City-Values header); this stays for a frame that came without them.
 * Cached at the edge for a day.
 */
export async function GET(req: Request) {
  const slow = limited(req, "models/points", LIMITS.heavy);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const model = q.get("model") as ModelId;
  const m = MODELS[model];
  const cycle = q.get("cycle") ?? "";
  const fh = Number(q.get("fh"));
  const p = m && paramOf(model, q.get("p") ?? "");
  if (
    !m ||
    !p ||
    !/^\d{10}$/.test(cycle) ||
    !m.cycles.includes(+cycle.slice(8)) ||
    !m.hours.includes(fh)
  )
    return new Response("Bad request", { status: 400 });
  // HRRR and GFS are drawn in the viewer from NOAA's own files; only REFS is drawn here, so
  // the server's free usage stays small (owner, 2026-11-02).
  if (m.tpl)
    return new Response("Drawn in the browser", {
      status: 410,
      headers: { "Cache-Control": "public, s-maxage=86400" },
    });
  try {
    const v = cityValues(await fieldFor(model, cycle, fh, p), p);
    return Response.json(
      { v },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return new Response("Values unavailable", { status: 502 });
  }
}
