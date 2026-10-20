import {
  tornadoPositionAt,
  widthAt,
  type PreparedTornado,
} from "@/features/replay/core/chase";

/**
 * The storm camera (#4): overhead, following the tornadoes.
 *
 * What it frames at any moment:
 *
 *   * every tornado on the ground — and each one a few minutes ahead along
 *     its own track, so the frame is already where the tornado is going
 *     rather than chasing it to the edge;
 *   * with nothing on the ground, the next tornado to touch down, if it is
 *     soon, so the camera is waiting at the touchdown instead of wandering;
 *   * otherwise nothing, and the camera holds where it is.
 *
 * Each tornado is framed with generous room around it, never less than a few
 * miles, so a single tornado is shown in its surroundings rather than filling
 * the screen. The zoom ceiling is the caller's (`maxZoom`), for the same
 * reason.
 *
 * This decides only *what* to frame. Turning a box into a centre and a zoom
 * that clear the HUD is MapLibre's `cameraForBounds`, and the easing between
 * frames happens in the map, in real time, so the camera glides the same way
 * at 1x and at 750x.
 */

export interface StormFrameOptions {
  /** Replay seconds of look-ahead along each track. */
  lookAhead?: number;
  /** How far ahead a touchdown may be and still be waited for, replay seconds. */
  waitFor?: number;
  /** The least room kept around a tornado, metres. */
  minRoomM?: number;
}

export type Bounds = [[number, number], [number, number]]; // [[west, south], [east, north]]

/** Seconds either side of the surveyed times a tornado counts as present. */
const LEAD = 90;
const LINGER = 60;

export function tornadoesInFrame(
  tornadoes: readonly PreparedTornado[],
  at: number,
  waitFor = 20 * 60,
): PreparedTornado[] {
  const live = tornadoes.filter(
    (t) => at >= t.start - LEAD && at <= t.end + LINGER,
  );
  if (live.length) return live;
  const next = tornadoes
    .filter((t) => t.start > at && t.start - at <= waitFor)
    .sort((a, b) => a.start - b.start)[0];
  return next ? [next] : [];
}

export function stormBounds(
  tornadoes: readonly PreparedTornado[],
  at: number,
  opts: StormFrameOptions = {},
): Bounds | null {
  const lookAhead = opts.lookAhead ?? 240;
  const minRoom = opts.minRoomM ?? 5500;
  const framed = tornadoesInFrame(tornadoes, at, opts.waitFor);
  if (!framed.length) return null;

  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  const add = (lat: number, lon: number, roomM: number) => {
    const dLat = roomM / 111_320;
    const dLon =
      roomM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    w = Math.min(w, lon - dLon);
    e = Math.max(e, lon + dLon);
    s = Math.min(s, lat - dLat);
    n = Math.max(n, lat + dLat);
  };

  for (const t of framed) {
    const now = Math.min(t.end, Math.max(t.start, at));
    const room = Math.max(minRoom, widthAt(t, now) * 0.9144 * 1.5);
    const [lat, lon] = tornadoPositionAt(t, now);
    add(lat, lon, room);
    // Ahead along the track, so the frame leads the tornado.
    const ahead = Math.min(t.end, now + lookAhead);
    if (ahead > now) {
      const [la, lo] = tornadoPositionAt(t, ahead);
      add(la, lo, room * 0.6);
    }
  }
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * One step of the glide toward a target: exponential, by real elapsed time,
 * so the camera's pace does not depend on the frame rate or the replay speed.
 * Returns the fraction of the remaining distance to cover this frame.
 */
export function glide(dtSeconds: number, timeConstant = 0.55): number {
  if (!(dtSeconds > 0)) return 0;
  return 1 - Math.exp(-dtSeconds / timeConstant);
}
