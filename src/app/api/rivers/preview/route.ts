import { elevated } from "@/lib/rivers/data";

/** GET /api/rivers/preview → elevated gauges as colored dots for admin → Map & data colors. */
export async function GET() {
  try {
    const dots = (await elevated())
      .reverse()
      .map((g) => ({ lat: g.lat, lon: g.lon, key: `gauge:${g.level}` }));
    return Response.json(
      { dots },
      { headers: { "Cache-Control": "public, s-maxage=600" } },
    );
  } catch {
    return Response.json({ error: "Gauges unavailable." }, { status: 502 });
  }
}
