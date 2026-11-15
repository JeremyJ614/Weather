import { cleanBox, openShelters, sheltersIn } from "@/lib/disaster/shelters";
import { getSiteDefaults } from "@/lib/settings";
import { LIMITS, limited } from "@/lib/ratelimit";

/**
 * GET /api/disaster/shelters?open=1 → shelters open now, nationwide;
 * ?bbox=w,s,e,n → registered shelters in that box (whole degrees, at most 8° × 5°);
 * ?preview=1 → both as color-keyed dots for admin → Map & data colors.
 */
export async function GET(req: Request) {
  const slow = limited(req, "disaster/shelters", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const { disabled } = await getSiteDefaults();
  if (disabled.includes("shelters") && !q.has("preview"))
    return Response.json({ error: "The shelter map is off." }, { status: 404 });
  try {
    if (q.has("preview")) {
      const [open, ok] = await Promise.all([
        openShelters(),
        sheltersIn([-103, 33, -94, 38]),
      ]);
      return Response.json(
        {
          dots: [...ok, ...open].map((s) => ({
            lat: s.lat,
            lon: s.lon,
            key: s.open ? "shelter:open" : "shelter:registered",
          })),
        },
        { headers: { "Cache-Control": "public, s-maxage=3600" } },
      );
    }
    if (q.has("open"))
      return Response.json(
        { shelters: await openShelters() },
        {
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
          },
        },
      );
    const box = cleanBox(q.get("bbox"));
    if (!box)
      return Response.json(
        { error: "Zoom in a little more." },
        { status: 400 },
      );
    return Response.json(
      { shelters: await sheltersIn(box) },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "FEMA's shelter system isn't answering right now." },
      { status: 502 },
    );
  }
}
