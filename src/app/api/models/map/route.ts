import { getColors } from "@/lib/colors/server";
import {
  MODELS,
  REGIONS,
  cityValues,
  frameOf,
  rampColors,
  fieldFor,
  paint,
  paramOf,
  type ModelId,
} from "@/lib/models/render";
import { LIMITS, limited } from "@/lib/ratelimit";

export const maxDuration = 30;

/**
 * GET /api/models/map?model=&cycle=YYYYMMDDHH&fh=&p=&region= → one model field as a
 * transparent Web-Mercator PNG over the region, with the field's value at each map city in
 * the X-City-Values header (comma-separated, empty where none), so one request and one
 * download from NOAA serve both. A run never changes once published, so each frame is cached
 * at the edge for a day and in the browser for an hour.
 */
export async function GET(req: Request) {
  const slow = limited(req, "models/map", LIMITS.frames);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const model = q.get("model") as ModelId;
  const m = MODELS[model];
  const cycle = q.get("cycle") ?? "";
  const fh = Number(q.get("fh"));
  const p = m && paramOf(model, q.get("p") ?? "");
  const region = REGIONS[q.get("region") ?? "conus"];
  // A zoomed-in view (Fix list 2026-10-30 #8): its own sharp render, snapped to half degrees
  // so neighbors share the edge copy.
  const box = (q.get("bbox") ?? "").split(",").map(Number);
  const [cw, cs, ce, cn] = REGIONS.conus.b;
  const detail =
    box.length === 4 &&
    box.every(
      (v) => Number.isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9,
    ) &&
    box[0] >= cw - 5 &&
    box[2] <= ce + 5 &&
    box[1] >= cs - 5 &&
    box[3] <= cn + 5 &&
    box[2] - box[0] >= 1 &&
    box[2] - box[0] <= 25 &&
    box[3] - box[1] >= 1 &&
    box[3] - box[1] <= 20
      ? box
      : null;
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
    (q.has("bbox") && !detail) ||
    !/^\d{10}$/.test(cycle) ||
    !m.cycles.includes(+cycle.slice(8)) ||
    !(age >= 0 && age < 4 * 86400_000) ||
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
    const [f, colors] = await Promise.all([
      fieldFor(model, cycle, fh, p),
      getColors(),
    ]);
    const { png } = paint(
      f,
      p,
      rampColors(p, colors),
      detail ?? frameOf(model, region.b),
      detail ? 1600 : region.label === "CONUS" ? 2400 : 2000,
    );
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
        ...(detail
          ? {}
          : {
              "X-City-Values": cityValues(f, p)
                .map((v) => (v === null ? "" : String(v)))
                .join(","),
            }),
      },
    });
  } catch {
    return new Response("Frame unavailable", { status: 502 });
  }
}
