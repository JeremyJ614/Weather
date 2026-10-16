import { canSeeCams } from "@/lib/cams/access";
import { camsInWarnings } from "@/lib/cams/sources";

/** GET /api/cams/hazard → cameras inside active NWS warnings, grouped by warning. */
export async function GET() {
  if (!(await canSeeCams())) return new Response(null, { status: 404 });
  try {
    return Response.json(
      { groups: await camsInWarnings() },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  } catch {
    return Response.json({ error: "Warnings unavailable." }, { status: 502 });
  }
}
