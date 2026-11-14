import { getColors } from "@/lib/colors/server";
import {
  MODELS,
  REGIONS,
  frameOf,
  rampColors,
  recentCycles,
  type ModelId,
} from "@/lib/models/render";

/** GET /api/models/run?model=hrrr|gfs|refs → recent cycles, forecast hours and every parameter with its legend. */
export async function GET(req: Request) {
  const model = new URL(req.url).searchParams.get("model") as ModelId;
  const m = MODELS[model];
  if (!m) return Response.json({ error: "Unknown model." }, { status: 400 });
  const [cycles, colors] = await Promise.all([
    recentCycles(model, 4),
    getColors(),
  ]);
  if (!cycles.length)
    return Response.json(
      { error: "NOAA hasn't published a complete run yet. Try again soon." },
      { status: 502 },
    );
  return Response.json(
    {
      label: m.label,
      res: m.res,
      // HRRR and GFS: the viewer reads NOAA's files and draws the frames itself.
      tpl: m.tpl ?? null,
      cycles,
      hours: m.hours,
      regions: Object.entries(REGIONS).map(([id, r]) => ({
        id,
        ...r,
        f: frameOf(model, r.b),
      })),
      params: m.params.map((p) => ({
        key: p.key,
        label: p.label,
        group: p.group,
        unit: p.unit,
        levels: p.levels,
        full: !!p.full,
        clearAbove: !!p.clearAbove,
        // How to read the field from the model file (for frames drawn in the browser).
        match: p.match,
        also: p.also,
        extra: p.extra,
        combine: p.combine,
        coarse: p.coarse,
        win: p.win,
        hours: p.hours,
        colors: rampColors(p, colors),
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
