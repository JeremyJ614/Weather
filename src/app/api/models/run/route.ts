import { getColors } from "@/lib/colors/server";
import {
  MODELS,
  REGIONS,
  bandColors,
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
      cycles,
      hours: m.hours,
      regions: Object.entries(REGIONS).map(([id, r]) => ({ id, ...r })),
      params: m.params.map((p) => ({
        key: p.key,
        label: p.label,
        group: p.group,
        unit: p.unit,
        levels: p.levels,
        full: !!p.full,
        colors: bandColors(p, colors),
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
