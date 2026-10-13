import { mesoscale } from "@/lib/spc/md";

/** GET /api/spc/md[?lat=&lon=] → active SPC mesoscale discussions (or the last 72 h if none). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = q.has("lat") ? Number(q.get("lat")) : undefined;
  const lon = q.has("lon") ? Number(q.get("lon")) : undefined;
  try {
    return Response.json(
      await mesoscale(
        Number.isFinite(lat) ? lat : undefined,
        Number.isFinite(lon) ? lon : undefined,
      ),
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The SPC mesoscale feed isn't answering right now." },
      { status: 502 },
    );
  }
}
