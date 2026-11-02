import { MODEL_CITIES } from "@/lib/models/cities";
import {
  MODELS,
  fieldFor,
  paramOf,
  sampleAt,
  type ModelId,
} from "@/lib/models/render";

export const maxDuration = 30;

/**
 * GET /api/models/points?model=&cycle=&fh=&p= → the field's value at each city in
 * MODEL_CITIES (same order), printed on the map like Max Velocity's (owner, 2026-11-02).
 * A value is left out where the map draws nothing (radar under its first level, CIN near
 * zero), so a city never shows a number the map doesn't. Cached at the edge for a day.
 */
export async function GET(req: Request) {
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
  try {
    const f = await fieldFor(model, cycle, fh, p);
    const lv = p.levels;
    const lo = lv[0];
    const hi = lv[lv.length - 1];
    // Small ranges (inches of water, thousands of feet) read to a tenth; the rest whole.
    const tenth = hi - lo <= 10;
    const v = MODEL_CITIES.map(([, lat, lon]) => {
      const x = sampleAt(f, lat, lon);
      if (x === null) return null;
      if (!p.full && !p.clearAbove && x < lo) return null;
      if (p.clearAbove && x > hi) return null;
      return tenth ? Math.round(x * 10) / 10 : Math.round(x);
    });
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
