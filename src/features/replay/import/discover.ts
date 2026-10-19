import { haversine } from "@/features/replay/core/geo";
import { SpatialIndex } from "@/features/replay/core/spatialIndex";
import type { TornadoInput } from "@/features/replay/core/chase";
import type { Fix } from "./types";

/**
 * Mode 2: given a route, find the tornadoes near it.
 *
 * The National Weather Service Damage Assessment Toolkit publishes every
 * surveyed track. This narrows a day's worth of them to the ones that actually
 * came near the route, at whatever radius the user asks for.
 */
export interface DiscoveryResult {
  tornado: TornadoInput;
  /** Closest the route ever came to this track, in metres. */
  nearestMetres: number;
}

export function tornadoesNearRoute(
  fixes: readonly Fix[],
  candidates: readonly TornadoInput[],
  radiusMiles: number,
): DiscoveryResult[] {
  if (!fixes.length) return [];
  const radiusM = radiusMiles * 1609.344;
  const refLat = fixes[0]![1];

  // Index the route, then ask each tornado how close it got — the cheaper
  // direction, because a route has far more points than a survey track.
  const index = new SpatialIndex(refLat, Math.max(1_000, radiusM / 4));
  index.addFeature(
    0,
    fixes.map((f) => [f[2], f[1]] as [number, number]),
  );

  const found: DiscoveryResult[] = [];
  for (const t of candidates) {
    let nearest = Infinity;
    for (const [lon, lat] of t.coords) {
      const hit = index.nearest(lat, lon, radiusM);
      if (hit && hit.distance < nearest) nearest = hit.distance;
    }
    // A short track can miss every route vertex; check the route against it too.
    if (nearest === Infinity && t.coords.length >= 2) {
      const tIndex = new SpatialIndex(refLat, Math.max(1_000, radiusM / 4));
      tIndex.addFeature(0, t.coords);
      for (
        let i = 0;
        i < fixes.length;
        i += Math.max(1, Math.floor(fixes.length / 400))
      ) {
        const hit = tIndex.nearest(fixes[i]![1], fixes[i]![2], radiusM);
        if (hit && hit.distance < nearest) nearest = hit.distance;
      }
    }
    if (nearest <= radiusM)
      found.push({ tornado: t, nearestMetres: Math.round(nearest) });
  }

  return found.sort((a, b) => a.nearestMetres - b.nearestMetres);
}

/** Time window the route covers, padded, for asking a survey API. */
export function routeWindow(fixes: readonly Fix[], padHours = 6) {
  if (!fixes.length) return null;
  const pad = padHours * 3600;
  return {
    from: new Date((fixes[0]![0] - pad) * 1000),
    to: new Date((fixes[fixes.length - 1]![0] + pad) * 1000),
  };
}

/** Bounding box of the route, padded by a radius in miles. */
export function routeBounds(fixes: readonly Fix[], padMiles = 50) {
  if (!fixes.length) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const f of fixes) {
    if (f[1] < minLat) minLat = f[1];
    if (f[1] > maxLat) maxLat = f[1];
    if (f[2] < minLon) minLon = f[2];
    if (f[2] > maxLon) maxLon = f[2];
  }
  const padLat = padMiles / 69;
  const padLon =
    padMiles / (69 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)));
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  };
}

/**
 * Mode 3: a tornado the user drew, turned into the same shape a surveyed one has.
 *
 * Forward speed and width are rendered to scale from these numbers, so what is
 * typed is what happens on the map — if you say 100 mph, it crosses ground at
 * 100 mph, because the position is interpolated from start, end and length.
 */
export interface DrawnTornado {
  name: string;
  ef: string;
  /** [lon, lat] along the path the user drew. */
  path: [number, number][];
  /** When it touched down, epoch seconds. */
  startEpoch: number;
  /** Forward speed in mph. */
  speedMph: number;
  widthYards: number;
  maxWindMph: number;
  injuries?: number;
  fatalities?: number;
}

export interface DrawnStats {
  lengthMiles: number;
  durationMinutes: number;
  speedMph: number;
  widthYards: number;
  areaAcres: number;
  bearingDegrees: number;
}

/** Path length in metres. */
function pathLength(path: readonly (readonly [number, number])[]): number {
  let m = 0;
  for (let i = 1; i < path.length; i += 1) {
    m += haversine(path[i - 1]![1], path[i - 1]![0], path[i]![1], path[i]![0]);
  }
  return m;
}

export function drawnStats(t: DrawnTornado): DrawnStats {
  const lengthM = pathLength(t.path);
  const lengthMiles = lengthM / 1609.344;
  const speed = Math.max(1, t.speedMph);
  const durationMinutes = (lengthMiles / speed) * 60;
  const widthM = t.widthYards * 0.9144;
  const first = t.path[0];
  const last = t.path[t.path.length - 1];
  let bearing = 0;
  if (first && last && t.path.length > 1) {
    const dx = (last[0] - first[0]) * Math.cos((first[1] * Math.PI) / 180);
    const dy = last[1] - first[1];
    bearing = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
  }
  return {
    lengthMiles,
    durationMinutes,
    speedMph: speed,
    widthYards: t.widthYards,
    // Damage path area, the figure surveys report.
    areaAcres: (lengthM * widthM) / 4046.86,
    bearingDegrees: bearing,
  };
}

/** Convert a drawn tornado into the shape the replay engine already understands. */
export function drawnToTornado(t: DrawnTornado, chaseT0: number): TornadoInput {
  const stats = drawnStats(t);
  const start = t.startEpoch - chaseT0;
  return {
    name: t.name || "Drawn tornado",
    ef: t.ef,
    start,
    // End time follows from length and speed, which is what makes the map match
    // the number typed rather than approximating it.
    end: start + Math.round(stats.durationMinutes * 60),
    coords: t.path,
    lengthMi: stats.lengthMiles,
    widthYd: t.widthYards,
    maxwind: t.maxWindMph,
    inj: t.injuries ?? 0,
    fat: t.fatalities ?? 0,
  };
}
