import { ALBERS_WKT, MAP_H, MAP_W, canvasToAlbers } from "@/lib/map/usAlbers";
import { RASTERS } from "@/lib/map/products";
import { LIMITS, limited } from "@/lib/ratelimit";

/**
 * A NOAA raster drawn in our projection for the whole canvas at 2× (sharp on
 * phones), proxied so it is same-origin and the map can be saved as a PNG.
 */
export async function GET(req: Request) {
  const slow = limited(req, "maps/raster", LIMITS.frames);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const key = q.get("p") as keyof typeof RASTERS;
  const r = RASTERS[key];
  if (!r) return new Response("Unknown raster", { status: 400 });
  const t = Number(q.get("t"));
  const [x0, y0] = canvasToAlbers(0, MAP_H);
  const [x1, y1] = canvasToAlbers(MAP_W, 0);
  const sr = encodeURIComponent(JSON.stringify({ wkt: ALBERS_WKT }));
  const url =
    `${r.url}?bbox=${x0},${y0},${x1},${y1}&bboxSR=${sr}&imageSR=${sr}` +
    `&size=${MAP_W * 2},${MAP_H * 2}&transparent=true${r.extra}` +
    (key === "heat" && t > 0 ? `&time=${t}` : "") +
    "&f=image";
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(25000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/"))
      return new Response("NOAA raster unavailable", { status: 502 });
    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch {
    return new Response("NOAA raster unavailable", { status: 502 });
  }
}
