/**
 * Coordinates are snapped to a 0.02° grid (about 2 km) before they reach any cache, so the
 * number of cache keys is bounded by the grid, not by how many people open the app
 * (storage safety rule 3). It also means we never store a precise GPS position.
 */
export const GRID = 0.02;

export function snap(lat: number, lon: number): [number, number] {
  const r = (v: number) => Number((Math.round(v / GRID) * GRID).toFixed(2));
  return [r(lat), r(lon)];
}

export function validCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

export function parseZip(raw: string): string | null {
  const z = raw.trim();
  return /^\d{5}$/.test(z) ? z : null;
}

export const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
