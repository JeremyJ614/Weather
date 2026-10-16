import { MODELS, modelSoundings, type ModelId } from "@/lib/soundings/data";

/** GET /api/soundings/model?m=HRRR&lat=&lon= → every hour of the newest run nearby. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const m = q.get("m") as ModelId;
  const lat = Math.round(Number(q.get("lat")) * 10) / 10;
  const lon = Math.round(Number(q.get("lon")) * 10) / 10;
  if (
    !MODELS.some((x) => x.id === m) ||
    !(lat > 10 && lat < 75 && lon > -180 && lon < -50)
  )
    return Response.json(
      { error: "Pick a model and a North American point." },
      { status: 400 },
    );
  try {
    const s = await modelSoundings(m, lat, lon);
    if (!s)
      return Response.json(
        { error: "No model sounding near there." },
        { status: 404 },
      );
    return Response.json(s, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "Model soundings unavailable." },
      { status: 502 },
    );
  }
}
