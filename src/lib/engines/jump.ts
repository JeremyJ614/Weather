/**
 * Lightning Surge Detector math (Extras engine), after Schultz et al.'s "2σ" lightning jump:
 * a storm's total flash rate is read every ~2 minutes; its rate of change (DFRDT) is compared
 * with the spread of the previous five (about 10 minutes). A rise beyond two standard
 * deviations, in a storm already flashing at least 10 times a minute, is a jump. Pure math,
 * shared by the server and the tests.
 */
export type RatePoint = { t: number; fr: number };

export type Surge = {
  /** How far the latest change in flash rate sits above the recent spread, in σ. */
  sigma: number;
  /** The biggest jump in the window, in σ (0 if none). */
  peak: number;
  /** Minutes since the latest jump, or null when there was none. */
  since: number | null;
  /** When the latest jump was read (ms), or null. */
  at: number | null;
  /** Flash rate climbing faster than usual, short of a jump. */
  rising: boolean;
};

/** Flashes a minute a storm must reach before a rise counts (Schultz et al. 2009). */
export const MIN_RATE = 10;
/** The spread is never taken as less than this (flashes/min²), so a flat storm can't "jump" by 1. */
const FLOOR = 0.5;
/** A jump keeps a storm flagged this many minutes. */
export const HOLD_MIN = 10;

const sd = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};

/** Jumps in a storm's flash-rate history (oldest first, ~2 minutes apart). */
export function surge(points: RatePoint[], now = points.at(-1)?.t ?? 0) {
  const d: { t: number; v: number; fr: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].t - points[i - 1].t) / 60_000;
    if (dt > 0.5)
      d.push({
        t: points[i].t,
        v: (points[i].fr - points[i - 1].fr) / dt,
        fr: points[i].fr,
      });
  }
  let sigma = 0;
  let peak = 0;
  let last: number | null = null;
  // Each change needs at least three before it to judge against (five once the history allows).
  for (let i = 3; i < d.length; i++) {
    const s = Math.max(
      FLOOR,
      sd(d.slice(Math.max(0, i - 5), i).map((x) => x.v)),
    );
    const k = d[i].v / s;
    if (i === d.length - 1) sigma = k;
    if (k >= 2 && d[i].v > 0 && d[i].fr >= MIN_RATE) {
      peak = Math.max(peak, k);
      last = d[i].t;
    }
  }
  const fr = points.at(-1)?.fr ?? 0;
  return {
    sigma: Math.round(sigma * 10) / 10,
    peak: Math.round(peak * 10) / 10,
    since: last == null ? null : Math.round((now - last) / 60_000),
    at: last,
    rising: sigma >= 1 && fr >= 5,
  } satisfies Surge;
}

/**
 * The map band: 0 rising, 1 jump, 2 strong jump (3σ+, or a jump the radar backs up with
 * tightening rotation or a growing hail core); -1 is nothing to show.
 */
export function surgeBand(s: Surge, confirmed: boolean) {
  const jumped = s.since != null && s.since <= HOLD_MIN;
  if (jumped && (s.peak >= 3 || confirmed)) return 2;
  if (jumped) return 1;
  return s.rising ? 0 : -1;
}
