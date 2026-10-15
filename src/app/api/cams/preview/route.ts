import { getRealViewer } from "@/lib/auth/viewer";
import { allCams } from "@/lib/cams/sources";

/** GET /api/cams/preview → camera dots for admin → Map & data colors (admins only). */
export async function GET() {
  if (!(await getRealViewer()).isAdmin)
    return new Response(null, { status: 404 });
  const { cams } = await allCams();
  return Response.json({
    dots: cams.map((c) => ({ lat: c.lat, lon: c.lon, key: `cam:${c.kind}` })),
  });
}
