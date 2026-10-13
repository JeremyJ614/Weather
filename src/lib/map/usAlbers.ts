/**
 * Albers-USA projection (d3 geoAlbersUsa at scale 1300, translate 487.5,305 in a
 * 975×610 canvas), implemented exactly so data lands on the pre-projected state
 * outlines in ./data. Ported from the VIP app (src/lib/usAlbers.ts), which
 * documents why an affine fit was wrong.
 */
export const MAP_W = 975;
export const MAP_H = 610;

/** The scale and translate the shipped state paths were generated at. */
const K = 1300;
const TX = 487.5;
const TY = 305;
const RAD = Math.PI / 180;

/**
 * One conic equal-area lobe of the composite, as d3 defines it.
 *
 * `rotLon` is d3's `.rotate([rotLon, 0])`; `centerLon`/`centerLat` are its
 * `.center([...])`, which d3 interprets in the rotated frame — hence the
 * `-rotLon + centerLon` when locating it.
 */
function conic(
  p0deg: number,
  p1deg: number,
  rotLon: number,
  centerLon: number,
  centerLat: number,
) {
  const p0 = p0deg * RAD,
    p1 = p1deg * RAD;
  const n = (Math.sin(p0) + Math.sin(p1)) / 2;
  const c = 1 + Math.sin(p0) * (2 * n - Math.sin(p0));
  const r0 = Math.sqrt(c) / n;

  const raw = (lon: number, lat: number): [number, number] => {
    const x = (lon + rotLon) * RAD * n;
    const r = Math.sqrt(c - 2 * n * Math.sin(lat * RAD)) / n;
    return [r * Math.sin(x), r0 - r * Math.cos(x)];
  };
  const [cx, cy] = raw(-rotLon + centerLon, centerLat);

  return {
    center: [cx, cy] as const,
    forward(
      lon: number,
      lat: number,
      k: number,
      tx: number,
      ty: number,
    ): [number, number] {
      const [X, Y] = raw(lon, lat);
      return [tx + k * (X - cx), ty - k * (Y - cy)];
    },
    inverse(
      sx: number,
      sy: number,
      k: number,
      tx: number,
      ty: number,
    ): { lon: number; lat: number } {
      const X = (sx - tx) / k + cx;
      const Y = cy - (sy - ty) / k;
      const r0y = r0 - Y;
      const lonRot = (Math.atan2(X, Math.abs(r0y)) / n) * Math.sign(r0y || 1);
      const lat = Math.asin((c - (X * X + r0y * r0y) * n * n) / (2 * n));
      return { lon: lonRot / RAD - rotLon, lat: lat / RAD };
    },
  };
}

// d3's three lobes, verbatim.
const LOWER48 = conic(29.5, 45.5, 96, -0.6, 38.7);
const ALASKA = conic(55, 65, 154, -2.0, 58.5);
const HAWAII = conic(8, 18, 157, -3.0, 19.9);
const EPS = 1e-6;

/**
 * Where each lobe lives on the canvas, and the box that decides which lobe owns
 * a point. These fractions of the scale are d3's own, and getting them right is
 * what puts Alaska and Hawaii in their insets rather than in the Pacific.
 */
const LOBES = [
  {
    p: LOWER48,
    k: K,
    tx: TX,
    ty: TY,
    x0: TX - 0.455 * K,
    x1: TX + 0.455 * K,
    y0: TY - 0.238 * K,
    y1: TY + 0.238 * K,
  },
  {
    p: ALASKA,
    k: K * 0.35,
    tx: TX - 0.307 * K,
    ty: TY + 0.201 * K,
    x0: TX - 0.425 * K + EPS,
    x1: TX - 0.214 * K - EPS,
    y0: TY + 0.12 * K + EPS,
    y1: TY + 0.234 * K - EPS,
  },
  {
    p: HAWAII,
    k: K,
    tx: TX - 0.205 * K,
    ty: TY + 0.212 * K,
    x0: TX - 0.214 * K + EPS,
    x1: TX - 0.115 * K - EPS,
    y0: TY + 0.166 * K + EPS,
    y1: TY + 0.234 * K - EPS,
  },
] as const;

/**
 * lon/lat → the 975x610 canvas.
 *
 * Tries the lower 48 first, then the Alaska and Hawaii insets, exactly as d3
 * does: a point belongs to the first lobe whose clip box it lands inside.
 * Anything outside all three — mid-Pacific, deep into Canada — still returns the
 * lower-48 position rather than null, because every caller here draws polygons
 * that may legitimately run off the edge of the country, and a hole in a ring is
 * worse than a vertex past the border.
 */
export function project(lon: number, lat: number): { x: number; y: number } {
  for (const l of LOBES) {
    const [x, y] = l.p.forward(lon, lat, l.k, l.tx, l.ty);
    if (x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1) return { x, y };
  }
  const [x, y] = LOWER48.forward(lon, lat, K, TX, TY);
  return { x, y };
}

/**
 * Which lobe of the composite owns a point: 0 lower 48, 1 Alaska, 2 Hawaii.
 *
 * Exposed so a caller drawing a *polygon* can decide the lobe once for the whole
 * ring and then hold it. `project` decides per point, which is right for a dot
 * and wrong for a ring: a coastline in the Aleutians has vertices that fall
 * inside the Alaska inset box and vertices that do not, and projecting them
 * independently sends half the ring to the inset and half to a point two
 * thousand pixels above the map.
 */
export function lobeOf(lon: number, lat: number): number {
  for (let i = 0; i < LOBES.length; i++) {
    const l = LOBES[i];
    const [x, y] = l.p.forward(lon, lat, l.k, l.tx, l.ty);
    if (x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1) return i;
  }
  return 0;
}

/** Project forcing a particular lobe. See `lobeOf`. */
export function projectIn(
  lobe: number,
  lon: number,
  lat: number,
): { x: number; y: number } {
  const l = LOBES[lobe] ?? LOBES[0];
  const [x, y] = l.p.forward(lon, lat, l.k, l.tx, l.ty);
  return { x, y };
}

/**
 * Canvas → lon/lat.
 *
 * The inset boxes are tested FIRST and the lower 48 is the fallback — the
 * reverse of `project`. That is not a stylistic choice: the lower-48 clip box
 * spans the whole canvas, so both insets sit inside it, and checking it first
 * would resolve every click on Hawaii to a point in the Pacific off Baja.
 * (d3's own `albersUsa.invert` orders it the same way, for the same reason.)
 */
export function unproject(x: number, y: number): { lat: number; lon: number } {
  for (const l of [LOBES[1], LOBES[2]]) {
    if (x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1) {
      return l.p.inverse(x, y, l.k, l.tx, l.ty);
    }
  }
  return LOWER48.inverse(x, y, K, TX, TY);
}
/** Sphere radius for the raster requests (any radius works; the mapping is linear). */
export const SPHERE_R = 6371000;

/**
 * Canvas pixel → metres in a spherical Albers (CM −96°, parallels 29.5°/45.5°,
 * origin 0°): the WKT the raster services are asked to draw in, so a raster
 * exported for the canvas corners lines up with the lower-48 outlines exactly.
 */
export function canvasToAlbers(x: number, y: number): [number, number] {
  const [cx, cy] = LOWER48.center;
  return [SPHERE_R * ((x - TX) / K + cx), SPHERE_R * (cy - (y - TY) / K)];
}

export const ALBERS_WKT = `PROJCS["SSWX_Albers_Sphere",GEOGCS["GCS_Sphere",DATUM["D_Sphere",SPHEROID["Sphere",${SPHERE_R},0.0]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Albers"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-96.0],PARAMETER["Standard_Parallel_1",29.5],PARAMETER["Standard_Parallel_2",45.5],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;
