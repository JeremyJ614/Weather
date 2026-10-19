/**
 * What the map should be telling you, right now, in words.
 *
 * The old app had these and this one did not, and that gap was most of what
 * made the replay feel like a diagram rather than a chase. A funnel moving
 * across a basemap is a shape; "Celina EF1 on the ground, 2.1 miles north-east
 * of you, closing at 32 mph" is a situation. The map can draw the first. Only
 * a card can say the second.
 *
 * Everything here is a pure function of the replay and the clock, so the cards
 * can be tested without a map, a canvas or a browser — which matters because
 * the numbers on them are the part a reader will trust without checking.
 */
import { tornadoPositionAt, hailName } from "@/features/replay/core/chase";
import type { HailReport } from "@/features/replay/core/chase";
import {
  bearing,
  cardinal,
  haversine,
  metresToMiles,
} from "@/features/replay/core/geo";
import type { Replayable } from "../replayable";

/** How far back to look when deciding whether a tornado is closing or leaving. */
const TREND_SECONDS = 30;

/** A hail report stops being news after this long. */
export const HAIL_RECENT_SECONDS = 600;

/** How near a hail report has to be to count as "near you". */
const HAIL_NEAR_METRES = 48_000; // about thirty miles

export interface TornadoCard {
  index: number;
  name: string;
  ef: string;
  /** Metres from the chaser. Null on an archive day, which has no chaser. */
  metres: number | null;
  /** Compass point from the chaser to it — "NNE". Null with no chaser. */
  fromYou: string | null;
  /** Which way it is going, as a compass point. */
  heading: string;
  /** Its forward speed, mph. */
  mph: number;
  widthYd: number;
  maxwind: number;
  /**
   * Closing, leaving, or neither.
   *
   * Three states rather than a boolean, because "holding" is a real and
   * frightening thing for a tornado to be doing relative to you and rounding
   * it to either "closing" or "leaving" would be a lie in both directions.
   */
  trend: "closing" | "leaving" | "holding" | null;
  /** How long it has been on the ground, in seconds. */
  aground: number;
  /** How long it has left, in seconds. */
  remaining: number;
}

export interface HailCard {
  inches: number;
  /** What a chaser would call it — "Golf ball". */
  size: string;
  place: string;
  source: string;
  remark: string;
  /** Seconds since it was reported. */
  ago: number;
  /** Metres from the chaser, or null on an archive day. */
  metres: number | null;
  fromYou: string | null;
}

const MS_TO_MPH = 2.236_936;

/** Where the chaser is, or null if this replay has nobody driving through it. */
function chaserAt(
  r: Replayable,
  at: number,
): { lat: number; lon: number } | null {
  const p = r.track?.positionAt(at);
  return p ? { lat: p.lat, lon: p.lon } : null;
}

/**
 * The shortest baseline worth taking a heading over.
 *
 * A surveyed damage line is not a smooth curve. It is drawn around the damage
 * the office could find, so it wanders: a real 1.3-mile tornado in this data
 * has 38 vertices whose segment bearings run 270, 241, 186, 132, 21, 277 —
 * every direction on the compass, on a track that is genuinely heading south.
 * Sampling it over a short window reports that wander as the tornado's
 * direction, which is worse than useless because it looks authoritative.
 *
 * Half a kilometre of path averages the wander out while still following a
 * track that really does curve.
 */
const HEADING_BASELINE_M = 500;

/**
 * Which way a tornado is actually going at this moment.
 *
 * Widened from the sample point until the two positions are far enough apart
 * to mean something, rather than a fixed slice of the tornado's life — a slow
 * tornado covers almost no ground in five per cent of its duration, and that
 * is exactly when the heading needs the longest baseline.
 */
function headingOf(r: Replayable, index: number, at: number): number {
  const t = r.tornadoes[index]!;
  const life = Math.max(1, t.end - t.start);

  let span = Math.max(1, life * 0.05);
  let a = tornadoPositionAt(t, Math.max(t.start, at - span));
  let b = tornadoPositionAt(t, Math.min(t.end, at + span));

  // Grow the window until the baseline is long enough, or it has swallowed
  // the whole tornado and there is nothing left to grow into.
  while (
    haversine(a[0], a[1], b[0], b[1]) < HEADING_BASELINE_M &&
    span < life
  ) {
    span *= 2;
    a = tornadoPositionAt(t, Math.max(t.start, at - span));
    b = tornadoPositionAt(t, Math.min(t.end, at + span));
  }

  return bearing(a[0], a[1], b[0], b[1]);
}

/** Every tornado on the ground right now, nearest first. */
export function tornadoCards(r: Replayable, at: number): TornadoCard[] {
  const you = chaserAt(r, at);
  const cards: TornadoCard[] = [];

  for (const t of r.tornadoes) {
    if (at < t.start || at > t.end) continue;
    const [lat, lon] = tornadoPositionAt(t, at);

    let metres: number | null = null;
    let fromYou: string | null = null;
    let trend: TornadoCard["trend"] = null;

    if (you) {
      metres = haversine(you.lat, you.lon, lat, lon);
      fromYou = cardinal(bearing(you.lat, you.lon, lat, lon));

      // Compare against where both of you were half a minute ago. Clamped to
      // the tornado's own start so a card that appears at touchdown does not
      // compute a trend against a position the tornado never occupied.
      const back = Math.max(t.start, at - TREND_SECONDS);
      if (back < at) {
        const youThen = chaserAt(r, back);
        const [latThen, lonThen] = tornadoPositionAt(t, back);
        if (youThen) {
          const was = haversine(youThen.lat, youThen.lon, latThen, lonThen);
          const change = metres - was;
          // A tenth of a mile over half a minute is the threshold. Below it
          // the reading is noise from GPS jitter, not a trend.
          if (change < -160) trend = "closing";
          else if (change > 160) trend = "leaving";
          else trend = "holding";
        }
      }
    }

    cards.push({
      index: t.index,
      name: t.name,
      ef: t.ef,
      metres,
      fromYou,
      heading: cardinal(headingOf(r, t.index, at)),
      mph: Math.round(t.speedMs * MS_TO_MPH),
      widthYd: Math.round(t.widthYd),
      maxwind: t.maxwind,
      trend,
      aground: Math.max(0, at - t.start),
      remaining: Math.max(0, t.end - at),
    });
  }

  cards.sort((a, b) => (a.metres ?? Infinity) - (b.metres ?? Infinity));
  return cards;
}

/**
 * The hail worth mentioning at this moment.
 *
 * Not every report — the biggest recent one near the chaser, and nothing at
 * all when the biggest recent stone is small. A card that says "0.75 inch hail
 * reported" every four minutes for six hours trains you to ignore the card,
 * and then it is not there when the stone is four inches across.
 */
export function hailCard(r: Replayable, at: number): HailCard | null {
  if (r.hail.length === 0) return null;
  const you = chaserAt(r, at);

  let best: HailReport | null = null;
  for (const h of r.hail) {
    const [t, lat, lon, inches] = h;
    if (t > at || at - t > HAIL_RECENT_SECONDS) continue;
    if (you && haversine(you.lat, you.lon, lat, lon) > HAIL_NEAR_METRES)
      continue;
    if (!best || inches > best[3] || (inches === best[3] && t > best[0]))
      best = h;
  }
  if (!best) return null;

  const [t, lat, lon, inches, place, source, remark] = best;
  return {
    inches,
    size: hailName(inches),
    place,
    source,
    remark,
    ago: at - t,
    metres: you ? haversine(you.lat, you.lon, lat, lon) : null,
    fromYou: you ? cardinal(bearing(you.lat, you.lon, lat, lon)) : null,
  };
}

/** "2.1 mi", or "700 yd" when close enough that miles stop being useful. */
export function distanceLabel(metres: number): string {
  const mi = metresToMiles(metres);
  if (mi < 0.4) return `${Math.round(metres * 1.09361)} yd`;
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/** "4 min", "1h 12m" — for how long something has been going on. */
export function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export interface NextUp {
  index: number;
  name: string;
  ef: string;
  /** Seconds until it touches down. */
  inSeconds: number;
  /** Where it will touch down. */
  lat: number;
  lon: number;
  /** Metres from the chaser's position at that moment, or null with no chaser. */
  metres: number | null;
  /** How many more are still to come after this one, including it. */
  remaining: number;
}

/**
 * The next tornado to touch down, and how long until it does.
 *
 * The thing a chaser actually wants to know while watching a replay, and the
 * one question the map could not answer: everything on screen describes now,
 * and the scrub bar shows the whole day at once without saying which mark is
 * next. A countdown is the difference between reading a chart and waiting for
 * something.
 *
 * Distance is measured to where the chaser will *be* when it touches down,
 * not where they are now, because that is the honest answer to "how far am I
 * from the next one" on a replay where both are moving.
 */
export function nextTornado(r: Replayable, at: number): NextUp | null {
  let soonest: (typeof r.tornadoes)[number] | null = null;
  let remaining = 0;

  for (const t of r.tornadoes) {
    if (t.start <= at) continue;
    remaining += 1;
    if (!soonest || t.start < soonest.start) soonest = t;
  }
  if (!soonest) return null;

  const [lat, lon] = tornadoPositionAt(soonest, soonest.start);
  const you = r.track?.positionAt(soonest.start);

  return {
    index: soonest.index,
    name: soonest.name,
    ef: soonest.ef,
    inSeconds: soonest.start - at,
    lat,
    lon,
    metres: you ? haversine(you.lat, you.lon, lat, lon) : null,
    remaining,
  };
}

/**
 * A countdown, as a clock rather than a phrase.
 *
 * "4:32" rather than "4 minutes" because the seconds are the point — a
 * countdown that only moves once a minute is a label, not a countdown. Hours
 * appear only when there are any, so a normal wait is four characters wide and
 * does not make the layout jump.
 */
export function countdownLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
