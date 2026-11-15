import { geoPath, serviceLayer } from "@/lib/map/geo";
import { getColors } from "@/lib/colors/server";
import { VECTOR, colorFor, legendFor, rank } from "@/lib/map/products";
import { LIMITS, limited } from "@/lib/ratelimit";

/** One national vector product, projected to our canvas: { title, valid, polys, legend }. */
export async function GET(req: Request) {
  const slow = limited(req, "maps/layer", LIMITS.frames);
  if (slow) return slow;
  const id = new URL(req.url).searchParams.get("p") ?? "";
  const product = VECTOR.find((v) => v.id === id);
  if (!product) return Response.json({ error: "Unknown map" }, { status: 400 });
  try {
    const [feats, colors] = await Promise.all([
      serviceLayer<Record<string, unknown>>(product.url, 1800),
      getColors(),
    ]);
    const polys = feats
      .map((f) => ({
        c: colorFor(product.kind, f.properties, colors),
        r: rank(product.kind, f.properties),
        d: geoPath(f.geometry),
      }))
      .filter((p): p is { c: string; r: number; d: string } => !!p.c && !!p.d)
      .sort((a, b) => a.r - b.r)
      .map(({ c, d }) => ({ c, d }));
    const p = feats[0]?.properties ?? {};
    const date = (v: unknown) =>
      typeof v === "number"
        ? new Date(v).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        : null;
    // SPC GeoJSON carries VALID/EXPIRE as YYYYMMDDHHmm UTC.
    const spc = (v: unknown) =>
      typeof v === "string" && /^\d{12}$/.test(v)
        ? `${new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${v.slice(8, 10)}Z`
        : null;
    const valid =
      (p.VALID ? `${spc(p.VALID)} – ${spc(p.EXPIRE)}` : undefined) ??
      (p.valid_time as string | undefined) ??
      (p.valid_seas as string | undefined) ??
      (p.target as string | undefined) ??
      (p.start_date ? `${date(p.start_date)} – ${date(p.end_date)}` : null);
    return Response.json(
      {
        title: product.title,
        valid,
        polys,
        legend: legendFor(product.kind, colors),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "NOAA's map service isn't answering right now." },
      { status: 502 },
    );
  }
}
