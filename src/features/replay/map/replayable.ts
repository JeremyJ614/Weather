/**
 * One shape the map can replay, whatever it came from.
 *
 * A chase and an archive day are different things — one has a chaser driving
 * through it, the other is a survey of a day nobody on this account was at —
 * but the map's job is identical for both: put tornado paths on the ground and
 * move them along a clock. Unifying them here is what lets an archive day be
 * opened on the map at all, rather than being a page you can only read.
 *
 * The difference that survives is `track`: an archive day has none, and every
 * consumer has to cope with that rather than assume a chaser exists.
 */
import type { ArchiveEvent, WindField } from "@/features/replay/archive/types";
import type {
  ChasePayload,
  DamageContour,
  DamagePoint,
  HailReport,
  PreparedChase,
  PreparedTornado,
  WarningPolygonInput,
} from "@/features/replay/core/chase";
import { Track } from "@/features/replay/core/track";
import { cumulative } from "@/features/replay/core/geo";

export type ReplayKind = "chase" | "archive";

export interface Replayable {
  id: string;
  kind: ReplayKind;
  title: string;
  subtitle?: string;
  tz: string;
  /** Epoch seconds the offsets below are measured from. */
  T0: number;
  /** The span the scrub bar covers. */
  window: [number, number];
  tornadoes: PreparedTornado[];
  /** The chaser's track, or null for an archive day. */
  track: Track | null;
  /**
   * The NWS warning polygons in force during the replay (Z3 #16).
   *
   * Empty for an archive day: the storm-based warning archive begins in 2002,
   * and most of the archive predates it. An empty list is the honest answer
   * there — a day with no polygons is not a day where nobody was warned, it
   * is a day nobody drew polygons, and the map says nothing rather than
   * inventing something.
   */
  warnings: WarningPolygonInput[];
  /**
   * The surveyed damage contours — the real swath shape.
   *
   * Empty for an archive day that has no survey, and for any chase whose
   * payload predates these being carried. The map falls back to drawing the
   * centreline offset by the surveyed width, which is a summary rather than
   * the finding, and says as much.
   */
  contours: DamageContour[];
  /** The survey's damage points: what was hit, how hard, by which tornado. */
  damage: DamagePoint[];
  /**
   * The day's hail reports.
   *
   * Empty for an archive day, and for any chase built before these were
   * carried. Empty means nothing is drawn — a day with no reports is not a
   * day with no hail, and the map should not claim otherwise.
   */
  hail: HailReport[];
  /** Wind fields measured wider than the damage, drawn separately and fainter. */
  fields?: WindField[];
  /** Shown on the map so a reconstruction is never mistaken for a survey. */
  provenance?: string;
  /** 'F' for days rated on the Fujita scale. */
  scale?: "F" | "EF";
}

/** A prepared chase, as the map wants it. */
export function fromChase(
  id: string,
  chase: PreparedChase,
  track: Track | null,
  warnings: WarningPolygonInput[] = [],
  contours: DamageContour[] = [],
  damage: DamagePoint[] = [],
  hail: HailReport[] = [],
): Replayable {
  return {
    id,
    kind: "chase",
    title: chase.title,
    subtitle: chase.subtitle,
    tz: chase.tz,
    T0: chase.T0,
    // The whole drive, not just the window the tornadoes occupied.
    window: chase.trackWindow,
    tornadoes: chase.tornadoes,
    track,
    warnings,
    contours,
    damage,
    hail,
    scale: "EF",
  };
}

/**
 * An archive day, as the map wants it.
 *
 * The archive payload stores two surveyed endpoints per tornado (and, for the
 * 1925 reconstruction, a run of documented waypoints). Both are already the
 * coordinate list `PreparedTornado` expects, so the only work is the cumulative
 * distance table the position interpolator walks.
 */
export function fromArchive(event: ArchiveEvent): Replayable {
  const tornadoes: PreparedTornado[] = event.torn.map((t, index) => {
    const cum = cumulative(t.coords);
    const lengthM = cum[cum.length - 1] ?? 0;
    const span = Math.max(1, t.end - t.start);
    return {
      index,
      name: t.name,
      ef: t.ef,
      start: t.start,
      end: t.end,
      coords: t.coords,
      cum,
      lengthM,
      widthYd: t.widthYd,
      maxwind: t.maxwind ?? 0,
      injuries: t.inj,
      fatalities: t.fat,
      speedMs: lengthM / span,
      // Present only where the Damage Assessment Toolkit covers the event.
      ...(t.comments
        ? { comments: t.comments }
        : t.story
          ? { comments: t.story }
          : {}),
      ...(t.wfo ? { wfo: t.wfo } : {}),
      // The research's shape of the path, where it has one.
      ...(t.widths && t.widths.length === t.coords.length
        ? { widths: t.widths }
        : {}),
      ...(t.times && t.times.length === t.coords.length
        ? { times: t.times }
        : {}),
      ...(t.ratings && t.ratings.length === t.coords.length
        ? { ratings: t.ratings }
        : {}),
    };
  });

  const starts = tornadoes.map((t) => t.start);
  const ends = tornadoes.map((t) => t.end);

  return {
    id: event.id,
    kind: "archive",
    title: event.name,
    subtitle: event.region,
    tz: event.tz,
    T0: event.T0,
    window: tornadoes.length
      ? // A little air either side, so the first touchdown is not frame one.
        [Math.min(...starts) - 600, Math.max(...ends) + 600]
      : [0, 3600],
    tornadoes,
    track: null,
    /*
     * The survey, where there is one.
     *
     * These were hard-coded empty, which was right when the archive was built
     * from the SPC database alone and every event genuinely had none. Now that
     * `build_dat_archive.py` attaches the real contours, damage points, hail
     * and warnings wherever the archives cover the date, leaving them empty
     * would throw away the thing that makes an archive event replay like a
     * chase rather than like a diagram.
     */
    warnings: event.warns ?? [],
    contours: event.polys ?? [],
    damage: event.dpts ?? [],
    hail: event.hail ?? [],
    fields: event.fields ?? [],
    provenance: event.pathFidelity,
    scale: event.scale,
  };
}

/** Bounds that hold everything worth seeing, in [w, s, e, n]. */
export function boundsOf(
  r: Replayable,
): [number, number, number, number] | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;

  for (const t of r.tornadoes) {
    for (const [lon, lat] of t.coords) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  }
  if (r.track && r.track.n > 0) {
    /*
     * `Track.bounds()` is [minLat, minLon, maxLat, maxLon] — latitude first,
     * the order the track stores its arrays in. This used to be read as
     * [w, s, e, n], which put the southern edge of every chase at latitude
     * -88 and sent "fit" to the middle of the South Atlantic: the map did not
     * disappear, the camera left (#6).
     */
    const [minLat, minLon, maxLat, maxLon] = r.track.bounds();
    w = Math.min(w, minLon);
    e = Math.max(e, maxLon);
    s = Math.min(s, minLat);
    n = Math.max(n, maxLat);
  }
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

/** Which tornadoes are on the ground at a moment. */
export function activeAt(r: Replayable, at: number): PreparedTornado[] {
  return r.tornadoes.filter((t) => at >= t.start && at <= t.end);
}

/** A chase payload's raw fixes as a Track. */
export function trackFromPayload(payload: ChasePayload): Track {
  const n = payload.track.length;
  const t = new Float64Array(n);
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const fix = payload.track[i]!;
    t[i] = fix[0];
    lat[i] = fix[1];
    lon[i] = fix[2];
  }
  return new Track(t, lat, lon);
}
