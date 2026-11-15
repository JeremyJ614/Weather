import { hydrograph } from "@/lib/rivers/data";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/rivers/gauge?id=ABAG1 → that gauge's last 3 days and its forecast. */
export async function GET(req: Request) {
  const slow = limited(req, "rivers/gauge", LIMITS.normal);
  if (slow) return slow;
  const id = String(
    new URL(req.url).searchParams.get("id") ?? "",
  ).toUpperCase();
  if (!/^[A-Z0-9]{3,6}$/.test(id))
    return Response.json({ error: "Pick a gauge." }, { status: 400 });
  try {
    return Response.json(await hydrograph(id), {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "This gauge's history isn't available right now." },
      { status: 502 },
    );
  }
}
