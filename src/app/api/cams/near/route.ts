import { canSeeCams } from "@/lib/cams/access";
import { allCams, milesTo } from "@/lib/cams/sources";

/**
 * GET /api/cams/near?lat=&lon=[&kind=][&limit=][&id=] → the nearest cameras (12, up to 30)
 * within 100 miles
 * (or the one camera `id`), nearest first.
 */
export async function GET(req: Request) {
  if (!(await canSeeCams())) return new Response(null, { status: 404 });
  const q = new URL(req.url).searchParams;
  const { cams } = await allCams();
  const id = q.get("id");
  if (id) {
    const c = cams.find((x) => x.id === id);
    return c
      ? Response.json({ cams: [{ ...c, miles: 0 }] })
      : new Response(null, { status: 404 });
  }
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const kind = q.get("kind");
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return Response.json({ error: "Pick a place." }, { status: 400 });
  const list = cams
    .filter((c) => !kind || c.kind === kind)
    .map((c) => ({ ...c, miles: Math.round(milesTo(lat, lon, c)) }))
    .filter((c) => c.miles <= 100)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, Math.min(30, Math.max(1, Number(q.get("limit")) || 12)));
  return Response.json(
    { cams: list },
    { headers: { "Cache-Control": "private, max-age=600" } },
  );
}
