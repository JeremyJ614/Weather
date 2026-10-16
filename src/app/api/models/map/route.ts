import { getColors } from "@/lib/colors/server";
import {
  MODELS,
  REGIONS,
  bandColors,
  fieldFor,
  paint,
  paramOf,
  type ModelId,
} from "@/lib/models/render";

export const maxDuration = 30;

/**
 * GET /api/models/map?model=&cycle=YYYYMMDDHH&fh=&p=&region= → one model field as a
 * transparent Web-Mercator PNG over the region. A run never changes once published, so
 * each frame is cached at the edge for a day.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const model = q.get("model") as ModelId;
  const m = MODELS[model];
  const cycle = q.get("cycle") ?? "";
  const fh = Number(q.get("fh"));
  const p = m && paramOf(model, q.get("p") ?? "");
  const region = REGIONS[q.get("region") ?? "conus"];
  const age =
    Date.now() -
    Date.UTC(
      +cycle.slice(0, 4),
      +cycle.slice(4, 6) - 1,
      +cycle.slice(6, 8),
      +cycle.slice(8, 10),
    );
  if (
    !m ||
    !p ||
    !region ||
    !/^\d{10}$/.test(cycle) ||
    !m.cycles.includes(+cycle.slice(8)) ||
    !(age >= 0 && age < 4 * 86400_000) ||
    !m.hours.includes(fh)
  )
    return new Response("Bad request", { status: 400 });
  try {
    const [f, colors] = await Promise.all([
      fieldFor(model, cycle, fh, p),
      getColors(),
    ]);
    const { png } = paint(
      f,
      p,
      bandColors(p, colors),
      region.b,
      region.label === "CONUS" ? 1800 : 1400,
    );
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Frame unavailable", { status: 502 });
  }
}
