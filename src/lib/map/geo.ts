import { lobeOf, projectIn } from "./usAlbers";

type Ring = number[][];
export type Geometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] }
  | { type: string; coordinates?: unknown };

/**
 * Projects a GeoJSON (multi)polygon onto the 975×610 canvas as an SVG path.
 * Each ring keeps the lobe of its first vertex, and vertices closer than `tol`
 * px to the last kept one are dropped, so national products stay small.
 */
export function geoPath(g: Geometry | null | undefined, tol = 1.4): string {
  if (!g) return "";
  const polys: Ring[][] =
    g.type === "Polygon"
      ? [(g as { coordinates: Ring[] }).coordinates]
      : g.type === "MultiPolygon"
        ? (g as { coordinates: Ring[][] }).coordinates
        : [];
  let d = "";
  for (const poly of polys)
    for (const ring of poly) {
      if (ring.length < 4) continue;
      const lobe = lobeOf(ring[0][0], ring[0][1]);
      let lx = Infinity;
      let ly = Infinity;
      let n = 0;
      let part = "";
      let area = 0;
      let fx = 0;
      let fy = 0;
      ring.forEach(([lon, lat], i) => {
        const { x, y } = projectIn(lobe, lon, lat);
        const last = i === ring.length - 1;
        if (!last && Math.abs(x - lx) < tol && Math.abs(y - ly) < tol) return;
        if (n) area += lx * y - x * ly;
        else [fx, fy] = [x, y];
        part += `${n ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
        lx = x;
        ly = y;
        n++;
      });
      area += lx * fy - fx * ly;
      // Specks under ~3×3 px can't be seen at national scale.
      if (n >= 3 && Math.abs(area) / 2 >= 9) d += `${part}Z`;
    }
  return d;
}

/** Fetches a NOAA map-service layer as GeoJSON (generalized for a national view). */
export async function serviceLayer<P>(
  url: string,
  revalidate: number,
  fresh = false,
  where = "1=1",
): Promise<{ properties: P; geometry: Geometry }[]> {
  // Plain GeoJSON files (SPC) are fetched as they are; map services are queried.
  const q = url.endsWith(".geojson")
    ? url
    : `${url}/query?where=${encodeURIComponent(where)}&outFields=*&returnGeometry=true&maxAllowableOffset=0.04&geometryPrecision=3&outSR=4326&f=geojson`;
  const r = await fetch(q, {
    headers: { "User-Agent": "StormSync Weather (https://weather.sswx.space)" },
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`map service ${r.status}`);
  const j = (await r.json()) as {
    features?: { properties: P; geometry: Geometry }[];
  };
  return j.features ?? [];
}

/** A track (LineString or MultiLineString) as an SVG path on the national canvas. */
export function linePath(g: Geometry | null | undefined, tol = 0.6): string {
  if (!g) return "";
  const lines =
    g.type === "LineString"
      ? [(g as { coordinates: number[][] }).coordinates]
      : g.type === "MultiLineString"
        ? (g as { coordinates: number[][][] }).coordinates
        : [];
  let d = "";
  for (const line of lines) {
    if (line.length < 2) continue;
    const lobe = lobeOf(line[0][0], line[0][1]);
    let lx = Infinity;
    let ly = Infinity;
    let n = 0;
    line.forEach(([lon, lat], i) => {
      const { x, y } = projectIn(lobe, lon, lat);
      if (
        i &&
        i < line.length - 1 &&
        Math.abs(x - lx) < tol &&
        Math.abs(y - ly) < tol
      )
        return;
      d += `${n ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      lx = x;
      ly = y;
      n++;
    });
  }
  return d;
}
