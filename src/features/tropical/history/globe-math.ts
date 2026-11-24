/** Sphere math shared by the History Globe's scene, its wind-field layer and its tests. */
const R = Math.PI / 180;

/** A point on the unit sphere (three.js's equirectangular texture convention). */
export function xyz(lat: number, lon: number, r = 1): [number, number, number] {
  const c = Math.cos(lat * R);
  return [
    r * c * Math.cos(lon * R),
    r * Math.sin(lat * R),
    -r * c * Math.sin(lon * R),
  ];
}

/**
 * A land ring ready for a flat (equirectangular) map. Rings that cross the date line are
 * unwrapped so their longitudes run on continuously (Chukotka at 190° instead of −170°), and a
 * ring that circles a pole (Antarctica) is closed along that pole instead of straight across
 * the map. Drawing a ring as stored would join +180° to −180° with a line spanning the whole
 * world and flood the oceans between with land.
 */
export function flatRings(ring: Float32Array) {
  const pts: number[] = [ring[0], ring[1]];
  let lon = ring[0];
  let min = lon;
  let max = lon;
  for (let k = 2; k < ring.length; k += 2) {
    let d = ring[k] - ring[k - 2];
    if (d > 180) d -= 360;
    else if (d < -180) d += 360;
    lon += d;
    pts.push(lon, ring[k + 1]);
    min = Math.min(min, lon);
    max = Math.max(max, lon);
  }
  // Around the world once: close it through the pole on the ring's side.
  const wrap = Math.round((lon - pts[0]) / 360);
  if (wrap !== 0) {
    let sum = 0;
    for (let k = 1; k < pts.length; k += 2) sum += pts[k];
    const pole = sum > 0 ? 90 : -90;
    pts.push(lon, pole, pts[0], pole);
  }
  return [{ pts, min, max }];
}
