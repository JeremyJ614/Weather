import { Track } from "./track";

export type EfRating = "EFU" | "EF0" | "EF1" | "EF2" | "EF3" | "EF4" | "EF5";

export const EF_ORDER: Record<string, number> = {
  EFU: -1,
  EF0: 0,
  EF1: 1,
  EF2: 2,
  EF3: 3,
  EF4: 4,
  EF5: 5,
};

export interface TornadoInput {
  name: string;
  ef: string;
  /** Seconds relative to the chase T0. */
  start: number;
  end: number;
  /** [lon, lat] pairs along the surveyed centreline. */
  coords: [number, number][];
  lengthMi?: number;
  widthYd?: number;
  maxwind?: number;
  inj?: number;
  fat?: number;
  /** The survey's narrative — what the office found when they walked it. */
  comments?: string;
  /** The forecast office that surveyed it, e.g. 'LOT'. */
  wfo?: string;
  /**
   * The damage width at each vertex of `coords`, in yards.
   *
   * A tornado is not one width. The El Reno tornado of 2013 went from a few
   * hundred yards to 2.6 miles and back inside twenty minutes, and a single
   * number draws that as a ribbon. Where a survey gives the outline of the
   * damage, this carries it vertex by vertex; `widthYd` stays the maximum.
   */
  widths?: number[];
  /**
   * When the tornado was at each vertex, in seconds from T0.
   *
   * Without it the funnel moves along the path at the average speed of the
   * whole track, which is right for a survey that only gives a start and an
   * end. With it — El Reno's position was logged minute by minute, the
   * Tri-State tornado's by the clocks people stopped at — the funnel slows,
   * stalls and turns when the real one did.
   */
  times?: number[];
  /** The rating along the path at each vertex, where the survey rated it in segments. */
  ratings?: string[];
}

/**
 * One NWS storm-based warning polygon, as the payload carries it.
 *
 * Built by `scripts/build_warnings.py` from the IEM VTEC archive — these are
 * the polygons the Weather Service actually drew, not shapes inferred from the
 * tornado track. That matters because the warning lane exists to answer "how
 * much lead time did I have", and an inferred polygon would answer it by
 * assuming it.
 */
export interface WarningPolygonInput {
  kind: "tornado" | "severe" | "emergency";
  /** Seconds relative to the chase T0, like everything else. */
  from: number;
  to: number;
  label: string;
  wfo: string;
  id: string;
  where?: string;
  /** Outer ring, [lon, lat]. */
  ring: [number, number][];
}

/**
 * One surveyed damage contour — the real swath, not a computed rectangle.
 *
 * The NWS survey draws these by hand around the area that took damage at each
 * rating, so a tornado has several nested ones: an EF0 envelope with an EF1
 * inside it and so on. That shape is the finding; a rectangle of the maximum
 * width is a summary of it that happens to be wrong everywhere except the
 * widest point.
 */
export interface DamageContour {
  /** Index into `torn` — which tornado this belongs to. */
  t: number;
  ef: string;
  /** Outer ring, [lon, lat]. */
  ring: [number, number][];
  /**
   * 'survey' (absent) for a contour a surveyor drew; 'swath' for the outline
   * the research built from a measured width profile, where no contour exists.
   */
  kind?: "survey" | "swath";
}

/**
 * One damage point from the survey.
 *
 * A tuple rather than an object because there are well over a thousand per
 * chase and the payload is already the largest thing the app downloads:
 * [lat, lon, ef, windMph, whatWasDamaged, degreeOfDamage, tornadoIndex]
 */
export type DamagePoint = [
  number,
  number,
  string,
  number,
  string,
  string,
  number,
];

/**
 * One hail report, as the Weather Service logged it.
 *
 * A tuple for the same reason damage points are: a big day carries a few
 * hundred and the payload is already the heaviest thing the app fetches.
 *   [tSinceT0, lat, lon, inches, place, source, remark]
 *
 * `inches` is the reported stone diameter, which is what every chaser
 * actually says out loud — "golfballs", "baseballs" — and what the size
 * ladder in the legend is built from. `source` is who called it in, and it
 * matters: a trained spotter's two inches and a Facebook photo's two inches
 * are not the same claim, so the card says which one you are reading.
 */
export type HailReport = [
  number,
  number,
  number,
  number,
  string,
  string,
  string,
];

/** The named sizes chasers use, largest first, with the diameter each starts at. */
export const HAIL_SIZES: readonly { at: number; name: string }[] = [
  { at: 4.5, name: "Grapefruit" },
  { at: 4.0, name: "Softball" },
  { at: 3.0, name: "Teacup" },
  { at: 2.75, name: "Baseball" },
  { at: 2.5, name: "Tennis ball" },
  { at: 2.0, name: "Hen egg" },
  { at: 1.75, name: "Golf ball" },
  { at: 1.5, name: "Ping pong ball" },
  { at: 1.25, name: "Half dollar" },
  { at: 1.0, name: "Quarter" },
  { at: 0.88, name: "Nickel" },
  { at: 0.75, name: "Penny" },
];

/** What a chaser would call a stone of this size. */
export function hailName(inches: number): string {
  for (const s of HAIL_SIZES) if (inches >= s.at) return s.name;
  return "Pea";
}

export interface ChasePayload {
  title: string;
  subtitle?: string;
  tz: string;
  T0: number;
  /** [tSinceT0, lat, lon] */
  track: [number, number, number][];
  torn: TornadoInput[];
  /** Survey damage points — what was hit, how hard, and by which tornado. */
  dpts?: DamagePoint[];
  /** Surveyed EF contour polygons. */
  polys?: DamageContour[];
  /** The day's hail reports, from the NWS local storm report archive. */
  hail?: HailReport[];
  warns?: WarningPolygonInput[];
  notes?: string[];
}

/** One chaser on the map. Yours is always the first. */
export interface Participant {
  id: string;
  name: string;
  colour: string;
  track: Track;
  /** True for the account holder's own track. */
  isOwner: boolean;
}

export interface Approach {
  tornadoIndex: number;
  /** Closest the chaser got, in metres. */
  metres: number;
  /** When that happened, seconds relative to T0. */
  at: number;
}

export interface Crossing {
  tornadoIndex: number;
  /** When the chaser crossed the centreline. */
  at: number;
  /** When the tornado passed that same spot. */
  tornadoAt: number;
  /** Positive means the chaser was there after the tornado. */
  gapSeconds: number;
  lat: number;
  lon: number;
}

export interface PreparedTornado {
  index: number;
  name: string;
  ef: string;
  start: number;
  end: number;
  coords: [number, number][];
  /** Cumulative metres along the centreline at each vertex. */
  cum: number[];
  lengthM: number;
  widthYd: number;
  maxwind: number;
  injuries: number;
  fatalities: number;
  /** Forward speed in m/s, from the surveyed length and duration. */
  speedMs: number;
  /** What the survey wrote about this tornado. */
  comments?: string;
  /** The forecast office that surveyed it. */
  wfo?: string;
  /** Damage width at each vertex, yards. See `TornadoInput.widths`. */
  widths?: number[];
  /** Seconds from T0 at each vertex. See `TornadoInput.times`. */
  times?: number[];
  /** Local rating at each vertex. See `TornadoInput.ratings`. */
  ratings?: string[];
}

export interface PreparedChase {
  title: string;
  subtitle?: string;
  tz: string;
  T0: number;
  tornadoes: PreparedTornado[];
  approaches: Approach[];
  crossings: Crossing[];
  /** Total metres driven, from the full-fidelity track. */
  totalMetres: number;
  trackPoints: number;
  /**
   * The span the tornadoes occupy — first touchdown to last lift.
   *
   * This is the *interesting* part of the day, not the whole of it.
   */
  window: [number, number];
  /**
   * The span the track occupies, which is the actual chase.
   *
   * These are very different numbers: the 10 March 2026 track runs about
   * fifteen hours while its tornado window is under four. Anything asking
   * "how long was the chase" or "what can I scrub to" wants this one —
   * windowing to the tornadoes throws away the drive out, which on most
   * chases is most of the day.
   */
  trackWindow: [number, number];
  strongest: string;
  /** Cache key, so a re-import of the same data is recognised. */
  signature: string;
}

/**
 * Where along the centreline a tornado was at a moment: the vertex it had
 * passed and how far it was towards the next, as [index, fraction].
 *
 * By the surveyed clock where there is one (`times`), otherwise by distance at
 * the track's average speed.
 */
export function progressAt(t: PreparedTornado, time: number): [number, number] {
  const n = t.coords.length;
  if (n < 2) return [0, 0];

  const times = t.times;
  if (times && times.length === n) {
    if (time <= times[0]!) return [0, 0];
    if (time >= times[n - 1]!) return [n - 2, 1];
    // Binary search: the vertex the tornado has most recently passed.
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (times[mid]! <= time) lo = mid;
      else hi = mid;
    }
    const span = times[hi]! - times[lo]!;
    return [lo, span > 0 ? (time - times[lo]!) / span : 0];
  }

  const span = t.end - t.start;
  const f = span <= 0 ? 0 : Math.max(0, Math.min(1, (time - t.start) / span));
  const target = f * t.lengthM;
  for (let i = 1; i < t.cum.length; i += 1) {
    if (t.cum[i]! >= target) {
      const seg = t.cum[i]! - t.cum[i - 1]! || 1;
      return [i - 1, (target - t.cum[i - 1]!) / seg];
    }
  }
  return [n - 2, 1];
}

/** Where a tornado was at a given moment, interpolated along its centreline, as [lat, lon]. */
export function tornadoPositionAt(
  t: PreparedTornado,
  time: number,
): [number, number] {
  if (t.coords.length === 1) return [t.coords[0]![1], t.coords[0]![0]];
  const [i, g] = progressAt(t, time);
  const a = t.coords[i]!;
  const b = t.coords[Math.min(i + 1, t.coords.length - 1)]!;
  return [a[1] + g * (b[1] - a[1]), a[0] + g * (b[0] - a[0])];
}

/**
 * How wide the damage was where the tornado was at a moment, in yards.
 *
 * The surveyed profile where there is one; otherwise the one number the
 * survey gave for the whole track.
 */
export function widthAt(t: PreparedTornado, time: number): number {
  const w = t.widths;
  if (!w || w.length !== t.coords.length || w.length < 2) return t.widthYd;
  const [i, g] = progressAt(t, time);
  return w[i]! + g * (w[Math.min(i + 1, w.length - 1)]! - w[i]!);
}

/** The rating where the tornado was at a moment, where the survey rated it in segments. */
export function ratingAt(t: PreparedTornado, time: number): string {
  const r = t.ratings;
  if (!r || r.length !== t.coords.length) return t.ef;
  const [i, g] = progressAt(t, time);
  return r[g < 0.5 ? i : Math.min(i + 1, r.length - 1)] ?? t.ef;
}

export const strongestOf = (tornadoes: { ef: string }[]): string =>
  tornadoes.reduce(
    (best, t) =>
      (EF_ORDER[t.ef] ?? -1) > (EF_ORDER[best] ?? -1) ? t.ef : best,
    "EFU",
  );
