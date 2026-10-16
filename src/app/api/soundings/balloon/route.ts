import { balloon } from "@/lib/soundings/data";

/** GET /api/soundings/balloon?id=KOUN&ts=YYYYMMDDHH00 → one balloon sounding. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const ts = q.get("ts") ?? "";
  if (!/^[A-Z0-9_]{3,5}$/.test(id) || !/^\d{12}$/.test(ts))
    return Response.json({ error: "Pick a station." }, { status: 400 });
  try {
    const s = await balloon(id, ts);
    if (!s) return Response.json({ error: "No launch." }, { status: 404 });
    return Response.json(s, {
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  } catch {
    return Response.json(
      { error: "Balloon data unavailable." },
      { status: 502 },
    );
  }
}
