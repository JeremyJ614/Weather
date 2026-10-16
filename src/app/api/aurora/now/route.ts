import { kp, ovation, solarWind } from "@/lib/aurora/data";

/** GET /api/aurora/now → OVATION sector grid with edge and view lines, Kp, solar wind. */
export async function GET() {
  const [o, k, w] = await Promise.all([
    ovation().catch(() => null),
    kp().catch(() => null),
    solarWind().catch(() => null),
  ]);
  if (!o && !k)
    return Response.json({ error: "SWPC isn't answering." }, { status: 502 });
  return Response.json(
    { ovation: o, kp: k, wind: w },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
