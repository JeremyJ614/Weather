import { parseZip } from "@/lib/weather/geo";
import { UpstreamError, lookupZip } from "@/lib/weather/nws";

/** GET /api/geo/zip?zip=12345 → { lat, lon, label } */
export async function GET(request: Request) {
  const zip = parseZip(new URL(request.url).searchParams.get("zip") ?? "");
  if (!zip)
    return Response.json(
      { error: "Enter a 5-digit ZIP code" },
      { status: 400 },
    );
  try {
    return Response.json(await lookupZip(zip), {
      headers: { "Cache-Control": "public, s-maxage=2592000" },
    });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 502;
    const message =
      e instanceof UpstreamError ? e.message : "ZIP lookup is unavailable";
    return Response.json({ error: message }, { status });
  }
}
