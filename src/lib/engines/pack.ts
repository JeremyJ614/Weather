import type { Areas } from "./areas";

/**
 * Engine map shapes, packed (review round, speed pick "engine-pack"): coordinates as whole
 * hundredths of a degree (about half a mile, finer than any engine's grid), each ring's first
 * point whole and the rest as steps from the one before. Small integers instead of long
 * decimals make a map roughly a third of the size, stored and sent. Client-safe.
 */
export type Packed = {
  packed: 1;
  /** Per feature: its band and its polygons' rings, flattened [x0, y0, dx1, dy1, …]. */
  f: { b: number; p: number[][][] }[];
};

const S = 100;

export function packAreas(a: Areas): Packed {
  return {
    packed: 1,
    f: a.features.map((ft) => ({
      b: ft.properties.band,
      p: ft.geometry.coordinates.map((poly) =>
        poly.map((ring) => {
          const out: number[] = [];
          let px = 0;
          let py = 0;
          for (const [x, y] of ring) {
            const ix = Math.round(x * S);
            const iy = Math.round(y * S);
            out.push(ix - px, iy - py);
            px = ix;
            py = iy;
          }
          return out;
        }),
      ),
    })),
  };
}

/** Areas back from packed form; plain areas (rows stored before packing) pass through. */
export function unpackAreas(a: Packed | Areas): Areas;
export function unpackAreas(a: Packed | Areas | null | undefined): Areas | null;
export function unpackAreas(
  a: Packed | Areas | null | undefined,
): Areas | null {
  if (!a) return null;
  if (!("packed" in a)) return a;
  return {
    type: "FeatureCollection",
    features: a.f.map((ft) => ({
      type: "Feature",
      properties: { band: ft.b },
      geometry: {
        type: "MultiPolygon",
        coordinates: ft.p.map((poly) =>
          poly.map((flat) => {
            const ring: number[][] = [];
            let x = 0;
            let y = 0;
            for (let i = 0; i < flat.length; i += 2) {
              x += flat[i];
              y += flat[i + 1];
              ring.push([x / S, y / S]);
            }
            return ring;
          }),
        ),
      },
    })),
  };
}
