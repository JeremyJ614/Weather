/**
 * Magnetic scrubbing (Z3 #19) and the strip chart behind the scrub bar (Z3 #18).
 *
 * Dragging a playhead across a three-hour chase means every pixel is worth
 * several seconds, so landing exactly on the moment a tornado touched down is
 * luck. Snapping makes the moments that matter into detents: the pointer is
 * free everywhere else and catches on the ones worth catching on.
 */

export type MomentKind =
  | "touchdown"
  | "lift"
  | "closest"
  | "crossing"
  | "warning"
  | "photo"
  | "note"
  | "start"
  | "end";

export interface Moment {
  /** Seconds from the chase T0. */
  at: number;
  kind: MomentKind;
  label: string;
  /** Rating, where the moment belongs to a tornado. */
  ef?: string;
  /** Index into the chase's tornado list, where relevant. */
  tornadoIndex?: number;
}

/**
 * How strongly each kind pulls the playhead, as a multiplier on the base
 * radius. A touchdown is the thing people scrub to look for; a note is not.
 */
const PULL: Record<MomentKind, number> = {
  touchdown: 1.4,
  closest: 1.3,
  crossing: 1.2,
  lift: 1.0,
  warning: 0.9,
  photo: 0.8,
  note: 0.7,
  start: 1.0,
  end: 1.0,
};

export interface SnapResult {
  /** Where the playhead should go. */
  at: number;
  /** The moment it caught on, if any. */
  moment: Moment | null;
}

/**
 * Snap a scrub position to the nearest moment within reach.
 *
 * `radiusSeconds` is the base reach, and should be computed from the pixel
 * width of the bar so that the detent is a constant *distance on screen*
 * rather than a constant number of seconds — a ten-second radius is enormous
 * on a zoomed-in bar and invisible on a zoomed-out one.
 */
export function snap(
  at: number,
  moments: readonly Moment[],
  radiusSeconds: number,
): SnapResult {
  if (radiusSeconds <= 0 || moments.length === 0) return { at, moment: null };

  let best: Moment | null = null;
  let bestScore = Infinity;

  for (const m of moments) {
    const reach = radiusSeconds * (PULL[m.kind] ?? 1);
    const distance = Math.abs(m.at - at);
    if (distance > reach) continue;
    // Normalise by reach so a strong detent wins a tie at equal distance.
    const score = distance / reach;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }

  return best ? { at: best.at, moment: best } : { at, moment: null };
}

/**
 * The reach in seconds that corresponds to a fixed number of pixels.
 *
 * Detents have to feel the same whatever the bar's width or the chase's
 * length, which means the radius is a screen distance converted to seconds,
 * never a fixed number of seconds.
 */
export function radiusFor(
  windowSeconds: number,
  barWidthPx: number,
  detentPx = 9,
): number {
  if (barWidthPx <= 0) return 0;
  return (windowSeconds / barWidthPx) * detentPx;
}

/** Step to the next or previous moment, for keyboard scrubbing. */
export function step(
  at: number,
  moments: readonly Moment[],
  direction: 1 | -1,
): Moment | null {
  const ordered = [...moments].sort((a, b) => a.at - b.at);
  if (direction === 1) return ordered.find((m) => m.at > at + 1e-6) ?? null;
  return [...ordered].reverse().find((m) => m.at < at - 1e-6) ?? null;
}

// ---------------------------------------------------------------------------
// The strip chart
// ---------------------------------------------------------------------------

export interface Band {
  /** Seconds from T0. */
  from: number;
  to: number;
  /** 0..1 — how much is happening. */
  intensity: number;
  /** How many tornadoes were on the ground in this slice. */
  onGround: number;
}

export interface TornadoSpan {
  start: number;
  end: number;
  /** For weighting: a violent tornado should read heavier than an EF0. */
  ef: string;
}

const EF_WEIGHT: Record<string, number> = {
  EFU: 0.5,
  EF0: 0.6,
  EF1: 0.75,
  EF2: 0.9,
  EF3: 1.1,
  EF4: 1.3,
  EF5: 1.5,
};

/**
 * Turn the day into a strip of bands, so the scrub bar shows *where the
 * activity is* rather than being an undifferentiated line.
 *
 * Intensity counts tornadoes on the ground in each slice, weighted by rating,
 * then normalised against the busiest slice — the bar answers "when was this
 * day at its worst", which is relative by nature.
 */
export function stripChart(
  window: [number, number],
  tornadoes: readonly TornadoSpan[],
  buckets = 120,
): Band[] {
  const [from, to] = window;
  const span = to - from;
  if (span <= 0 || buckets <= 0) return [];

  const width = span / buckets;
  const bands: Band[] = [];
  let peak = 0;

  for (let i = 0; i < buckets; i += 1) {
    const a = from + i * width;
    const b = a + width;
    let weight = 0;
    let onGround = 0;
    for (const t of tornadoes) {
      // Any overlap at all counts: a tornado that touched down inside this
      // slice and lifted in the next belongs to both.
      if (t.start < b && t.end > a) {
        onGround += 1;
        weight += EF_WEIGHT[t.ef] ?? 1;
      }
    }
    peak = Math.max(peak, weight);
    bands.push({ from: a, to: b, intensity: weight, onGround });
  }

  // Normalise last, so intensity is relative to the day's own worst moment.
  if (peak > 0) for (const band of bands) band.intensity /= peak;
  return bands;
}

// ---------------------------------------------------------------------------
// The warning lane (Z1 #09)
// ---------------------------------------------------------------------------

export interface WarningSpan {
  from: number;
  to: number;
  kind: "tornado" | "severe" | "emergency";
  label: string;
}

/**
 * Lay overlapping warnings into rows so none is hidden behind another.
 *
 * Warnings overlap constantly — a tornado warning inside a severe one, two
 * counties warned five minutes apart. Drawing them on one line means the later
 * one covers the earlier, and the lane silently under-reports.
 */
export function layoutWarnings(
  spans: readonly WarningSpan[],
): (WarningSpan & { row: number })[] {
  const ordered = [...spans].sort((a, b) => a.from - b.from || a.to - b.to);
  const rowEnds: number[] = [];
  const out: (WarningSpan & { row: number })[] = [];

  for (const span of ordered) {
    let row = rowEnds.findIndex((end) => end <= span.from);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(span.to);
    } else rowEnds[row] = span.to;
    out.push({ ...span, row });
  }
  return out;
}

/** Warnings in force at a moment — what the HUD shows. */
export function warningsAt(
  at: number,
  spans: readonly WarningSpan[],
): WarningSpan[] {
  return spans.filter((s) => at >= s.from && at <= s.to);
}
