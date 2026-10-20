import { contours } from "@/lib/map/contour";

/**
 * Engine maps drawn the way SPC draws an outlook (Fix-It List #17): nested, smooth filled
 * areas with outlines, one per band, instead of pixels or dots. Each feature carries its
 * `band` (0 = the lowest level); higher bands sit inside lower ones.
 */
export type Areas = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  { band: number }
>;

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Areas at each level of a lat/lon lattice whose row 0 is the north edge `N`. */
export function latticeAreas(
  vals: ArrayLike<number>,
  w: number,
  h: number,
  west: number,
  north: number,
  step: number,
  levels: number[],
  minArea = 2,
): Areas {
  return {
    type: "FeatureCollection",
    features: levels
      .map((lv, band) => ({
        type: "Feature" as const,
        properties: { band },
        geometry: {
          type: "MultiPolygon" as const,
          coordinates: contours(vals, w, h, lv, { minArea }).map((poly) =>
            poly.map((ring) =>
              ring.map(([x, y]) => [
                round(west + (x - 0.5) * step),
                round(north - (y - 0.5) * step),
              ]),
            ),
          ),
        },
      }))
      .filter((f) => f.geometry.coordinates.length),
  };
}

/** A 3 × 3 average over cells that have a value (NaN marks no value), `passes` times. */
export function soften(v: Float32Array, w: number, h: number, passes = 1) {
  let cur = v;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(cur.length).fill(NaN);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if (Number.isNaN(cur[j * w + i])) continue;
        let s = 0;
        let n = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const x = i + di;
            const y = j + dj;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const q = cur[y * w + x];
            if (!Number.isNaN(q)) {
              s += q;
              n++;
            }
          }
        out[j * w + i] = s / n;
      }
    cur = out;
  }
  return cur;
}

export type Segment = {
  /** [lon, lat] where the threat starts and ends. */
  a: [number, number];
  b: [number, number];
  value: number;
};

/**
 * Smooth areas around storm paths: each segment's value holds within `r0` km of its path
 * and fades to nothing by `r1` km; where storms overlap, the higher value wins.
 */
export function pathAreas(
  segs: Segment[],
  levels: number[],
  r0 = 8,
  r1 = 40,
  step = 0.05,
): Areas {
  if (!segs.length) return { type: "FeatureCollection", features: [] };
  const pad = r1 / 80 + step * 3;
  const xs = segs.flatMap((s) => [s.a[0], s.b[0]]);
  const ys = segs.flatMap((s) => [s.a[1], s.b[1]]);
  const west = Math.min(...xs) - pad;
  const north = Math.max(...ys) + pad;
  const w = Math.ceil((Math.max(...xs) + pad - west) / step) + 1;
  const h = Math.ceil((north - (Math.min(...ys) - pad)) / step) + 1;
  const v = new Float32Array(w * h);
  for (const s of segs) {
    const k = Math.cos((((s.a[1] + s.b[1]) / 2) * Math.PI) / 180) * 111.32;
    const ax = s.a[0] * k;
    const ay = s.a[1] * 111.32;
    const dx = s.b[0] * k - ax;
    const dy = s.b[1] * 111.32 - ay;
    const len = dx * dx + dy * dy;
    const i0 = Math.max(
      0,
      Math.floor((Math.min(s.a[0], s.b[0]) - pad - west) / step),
    );
    const i1 = Math.min(
      w - 1,
      Math.ceil((Math.max(s.a[0], s.b[0]) + pad - west) / step),
    );
    const j0 = Math.max(
      0,
      Math.floor((north - Math.max(s.a[1], s.b[1]) - pad) / step),
    );
    const j1 = Math.min(
      h - 1,
      Math.ceil((north - Math.min(s.a[1], s.b[1]) + pad) / step),
    );
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = (west + i * step) * k - ax;
        const py = (north - j * step) * 111.32 - ay;
        const t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
        const d = Math.hypot(px - t * dx, py - t * dy);
        if (d >= r1) continue;
        const f = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
        // Smoothstep, so the edge eases off instead of ending in a cone.
        const val = s.value * f * f * (3 - 2 * f);
        if (val > v[j * w + i]) v[j * w + i] = val;
      }
  }
  return latticeAreas(v, w, h, west, north, step, levels, 1);
}
