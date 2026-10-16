import { canSeeCams } from "@/lib/cams/access";
import { allCams } from "@/lib/cams/sources";
import { CAM_KINDS } from "@/lib/cams/style";

/** GET /api/cams/map → every camera as [lat, lon, kind index, id], plus feeds that are down. */
export async function GET() {
  if (!(await canSeeCams())) return new Response(null, { status: 404 });
  const { cams, down } = await allCams();
  return Response.json(
    {
      cams: cams.map((c) => [
        Math.round(c.lat * 1e4) / 1e4,
        Math.round(c.lon * 1e4) / 1e4,
        CAM_KINDS.findIndex((k) => k.key === c.kind),
        c.id,
      ]),
      down,
    },
    { headers: { "Cache-Control": "private, max-age=1800" } },
  );
}
