import { national } from "@/lib/lightning/data";
import { ltBand } from "@/lib/lightning/style";

/** GET /api/lightning/preview → today's hotspots as dots for admin → Map & data colors. */
export async function GET() {
  try {
    const n = await national();
    return Response.json({
      dots: (n?.hotspots ?? []).map((h) => ({
        lat: h.lat,
        lon: h.lon,
        key: `lt:${ltBand(h.peak).key}`,
      })),
    });
  } catch {
    return Response.json(
      { error: "Lightning data unavailable." },
      { status: 502 },
    );
  }
}
