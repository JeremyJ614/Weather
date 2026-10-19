/** Metres per degree of latitude. Constant enough at the scale of a chase. */
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON_EQ = 111_320;
export const EARTH_R = 6_371_008.8;
export const D2R = Math.PI / 180;

/** Great-circle distance in metres. */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * D2R;
  const dLon = (lon2 - lon1) * D2R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(Math.min(1, a)));
}

/**
 * Local flat projection around a reference latitude.
 *
 * Every geometric test in a chase happens inside a box a few hundred miles
 * across, where treating degrees as a plane is accurate to well under a metre
 * and roughly forty times cheaper than spherical trigonometry.
 */
export function projector(refLat: number) {
  const kx = M_PER_DEG_LON_EQ * Math.cos(refLat * D2R);
  const ky = M_PER_DEG_LAT;
  return {
    x: (lon: number) => lon * kx,
    y: (lat: number) => lat * ky,
    kx,
    ky,
  };
}

/** Perpendicular distance in metres from a point to the segment a-b. */
export function pointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let u = ((px - ax) * dx + (py - ay) * dy) / len2;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

export const metresToMiles = (m: number) => m / 1609.344;
export const milesToMetres = (mi: number) => mi * 1609.344;

export function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const y = Math.sin((lon2 - lon1) * D2R) * Math.cos(lat2 * D2R);
  const x =
    Math.cos(lat1 * D2R) * Math.sin(lat2 * D2R) -
    Math.sin(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.cos((lon2 - lon1) * D2R);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}

export const CARDINALS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export const cardinal = (deg: number) =>
  CARDINALS[Math.round(deg / 22.5) % 16]!;

/**
 * Cumulative distance along a [lon, lat] path, in metres.
 *
 * The position interpolator walks this table to find where along a centreline
 * a tornado is at a given moment, so it is needed anywhere a path becomes
 * replayable — a prepared chase and an archive day both.
 *
 * A single-point path gets a second point nudged east of it: a tornado with
 * one surveyed coordinate still has to have somewhere to be, and a zero-length
 * path divides by zero everywhere downstream.
 */
export function cumulative(coords: [number, number][]): number[] {
  if (coords.length === 0) return [0];
  if (coords.length === 1) return [0, 0];
  const cum = [0];
  for (let i = 1; i < coords.length; i += 1) {
    cum.push(
      cum[i - 1]! +
        haversine(
          coords[i - 1]![1],
          coords[i - 1]![0],
          coords[i]![1],
          coords[i]![0],
        ),
    );
  }
  return cum;
}
