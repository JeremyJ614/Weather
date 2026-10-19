/**
 * Web Mercator maths for the funnel layer.
 *
 * MapLibre's custom-layer matrix expects positions in its own mercator space,
 * where the world is the unit square and altitude is scaled by latitude. These
 * are the three conversions that need, written out rather than pulled from the
 * library so the shader's units are obvious at the call site.
 */

/** Metres around the equator. */
export const EARTH_CIRCUMFERENCE = 40_075_016.686;

export function mercatorX(lng: number): number {
  return (180 + lng) / 360;
}

export function mercatorY(lat: number): number {
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) /
    360
  );
}

/**
 * Mercator units per metre at a latitude.
 *
 * Mercator stretches away from the equator, so a metre near the poles covers
 * more of the unit square than a metre at the equator. A funnel drawn without
 * this is the wrong size everywhere except one line of latitude.
 */
export function metresToMercator(lat: number): number {
  return 1 / (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180));
}
