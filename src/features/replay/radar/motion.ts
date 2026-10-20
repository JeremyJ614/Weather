import {
  tornadoPositionAt,
  type PreparedTornado,
} from "@/features/replay/core/chase";

/**
 * The storm's motion, for storm-relative velocity.
 *
 * A supercell drifts at thirty or forty miles an hour, and the radar sees that
 * drift along every beam: the side of the storm moving towards the radar reads
 * faster inbound, the far side faster outbound, and a rotation of the same
 * strength looks lopsided or vanishes into the background flow. Taking the
 * storm's own motion out of every gate leaves only the circulation.
 *
 * Forecasters estimate that motion from the wind profile. A replay has
 * something better: the tornado's surveyed track is where the circulation
 * actually went. So the motion is the tornado's own, over the ten minutes
 * around the moment — or, between tornadoes, that of the one nearest in time.
 */
export interface StormMotion {
  /** Toward the east and toward the north, m/s. */
  east: number;
  north: number;
  /** m/s. */
  speed: number;
  /** Degrees clockwise from north that the storm is moving toward. */
  toward: number;
  /** Whose track it came from. */
  name: string;
}

const HALF_WINDOW = 300;

export function stormMotion(
  tornadoes: readonly PreparedTornado[],
  at: number,
): StormMotion | null {
  let best: PreparedTornado | null = null;
  let gap = Infinity;
  for (const t of tornadoes) {
    if (t.end - t.start < 60 || t.coords.length < 2) continue;
    const g = at < t.start ? t.start - at : at > t.end ? at - t.end : 0;
    if (g < gap) {
      gap = g;
      best = t;
    }
  }
  if (!best || gap > 3 * 3600) return null;

  let a = Math.max(best.start, Math.min(at, best.end) - HALF_WINDOW);
  let b = Math.min(best.end, a + 2 * HALF_WINDOW);
  a = Math.max(best.start, b - 2 * HALF_WINDOW);
  if (b - a < 60) {
    a = best.start;
    b = best.end;
  }

  const [lat0, lon0] = tornadoPositionAt(best, a);
  const [lat1, lon1] = tornadoPositionAt(best, b);
  const mid = ((lat0 + lat1) / 2) * (Math.PI / 180);
  const east = ((lon1 - lon0) * 111_195 * Math.cos(mid)) / (b - a);
  const north = ((lat1 - lat0) * 111_195) / (b - a);
  const speed = Math.hypot(east, north);
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 45) return null;
  const toward = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
  return { east, north, speed, toward, name: best.name };
}

/** "Greenfield, IA" -> "the Greenfield, IA tornado"; a name that already says tornado is left alone. */
export function tornadoLabel(name: string | undefined): string {
  if (!name) return "the tornado";
  return /tornado/i.test(name) ? name : `the ${name} tornado`;
}

const POINTS = [
  "north",
  "north-northeast",
  "northeast",
  "east-northeast",
  "east",
  "east-southeast",
  "southeast",
  "south-southeast",
  "south",
  "south-southwest",
  "southwest",
  "west-southwest",
  "west",
  "west-northwest",
  "northwest",
  "north-northwest",
];

/** 45 -> "northeast". */
export function compassWord(degrees: number): string {
  return POINTS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16]!;
}
