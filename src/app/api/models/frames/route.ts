import { MODEL_MAPS, magUrl, type ModelId } from "@/lib/radar/products";

/**
 * GET /api/models/frames?model=gfs|nam&field=… → the newest complete run's frames
 * (NCEP MAG keeps only the latest run per cycle hour, so the newest whose last frame
 * exists is the one to play).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const model = q.get("model") as ModelId;
  const field = q.get("field") ?? "";
  const m = MODEL_MAPS[model];
  if (!m || !(field in m.fields))
    return Response.json({ error: "Pick a model and map." }, { status: 400 });
  const now = Date.now();
  const base = Math.floor(now / 21600000) * 21600000;
  for (let k = 0; k < 5; k++) {
    const run = new Date(base - k * 21600000);
    const cycle = String(run.getUTCHours()).padStart(2, "0");
    const last = m.hours.at(-1)!;
    const r = await fetch(magUrl(model, cycle, field, last), {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    }).catch(() => null);
    if (!r?.ok) continue;
    return Response.json(
      {
        label: `${m.label} ${cycle}Z run · ${m.fields[field]} · NOAA NCEP`,
        frames: m.hours.map((h) => ({
          url: magUrl(model, cycle, field, h),
          at: new Date(run.getTime() + h * 3600000).toISOString(),
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  }
  return Response.json(
    { error: "No complete model run is available right now." },
    { status: 502 },
  );
}
