import { PAL } from "@/features/replay/palette";
/**
 * Warning polygons that breathe (Z3 #16), and the lead time they bought (Z1 #09).
 *
 * A warning polygon is the one object on this map that is about *people*
 * rather than weather: it is the moment the Weather Service decided this
 * ground was in danger. Drawn as a flat shape it reads as administrative
 * clutter; drawn with a slow pulse while it is in force and fading to a
 * dead outline once it expires, it reads as something that was alive and
 * is not any more, which is what it was.
 *
 * Everything here is pure and takes the clock as an argument, so the rhythm
 * is a function of replay time and not of wall time — scrubbing backwards
 * gives the same frame as scrubbing forwards, and a paused map does not
 * quietly keep pulsing.
 */
import type { WarningPolygonInput } from "@/features/replay/core/chase";
import type { Track } from "@/features/replay/core/track";

export type WarnKind = WarningPolygonInput["kind"];
export type WarnState = "pending" | "active" | "expiring" | "expired" | "gone";

/** How long the fill takes to die after the polygon expires, in seconds. */
export const EXPIRY_FADE = 240;

/**
 * How long an expired polygon stays on the map at all.
 *
 * Found by looking at it: a chase day carries seventy-odd polygons, and an
 * outline that lives forever means that by evening the map is a lattice of
 * dead quadrilaterals with the storm somewhere underneath. Forty-five minutes
 * keeps the useful reading — "the warning here had just expired when I
 * arrived" — and throws away the morning's warnings two counties back, which
 * are history rather than context.
 */
export const LINGER = 45 * 60;

/**
 * Rhythm carries urgency, exactly as it does on the proximity ring.
 *
 * Radians per second, so the period is 2*pi/rate: a severe warning breathes
 * about every 21 seconds, a tornado warning every 13, a tornado emergency
 * every 7. Slow enough that none of them is a strobe — this is a map people
 * look at for minutes at a time.
 */
const RATE: Record<WarnKind, number> = {
  severe: 0.3,
  tornado: 0.48,
  emergency: 0.9,
};

/** The fill band each kind breathes between. */
const FILL: Record<WarnKind, [number, number]> = {
  severe: [0.03, 0.09],
  tornado: [0.07, 0.19],
  emergency: [0.12, 0.3],
};

/**
 * Warning colours.
 *
 * Deliberately NOT the NWS ramp. The NWS red/orange is chosen to survive on a
 * white county map; on these dark grounds it vibrates against the EF scale and
 * competes with the tornado marks, which are the subject. These are stepped
 * into the same dark band as the rest of the palette so the polygons sit
 * behind the storm rather than in front of it — and kept apart from every EF
 * colour so a polygon is never mistaken for a rating.
 */
export const WARN_COLOUR: Record<WarnKind, string> = PAL.warn;

export interface WarnLook {
  state: WarnState;
  /** 0..1 fill opacity. */
  fill: number;
  /** 0..1 outline opacity. */
  line: number;
  /** Outline width in px. */
  width: number;
  colour: string;
}

export function warnStateAt(
  at: number,
  w: Pick<WarningPolygonInput, "from" | "to">,
): WarnState {
  if (at < w.from) return "pending";
  if (at <= w.to) return "active";
  if (at <= w.to + EXPIRY_FADE) return "expiring";
  if (at <= w.to + LINGER) return "expired";
  return "gone";
}

/**
 * How a polygon should look at this instant.
 *
 * The expired outline never reaches zero: a warning that was in force during
 * the chase stays on the map as a trace of where the danger had been, because
 * "the warning had already expired when I got there" is itself a finding.
 */
export function lookAt(
  at: number,
  w: Pick<WarningPolygonInput, "from" | "to" | "kind">,
): WarnLook {
  const state = warnStateAt(at, w);
  const colour = WARN_COLOUR[w.kind] ?? WARN_COLOUR.severe;
  if (state === "pending" || state === "gone")
    return { state, fill: 0, line: 0, width: 0, colour };

  if (state === "active") {
    const [lo, hi] = FILL[w.kind] ?? FILL.severe;
    // Phase-shifted per polygon so twenty warnings do not pulse in lockstep,
    // which would read as one animation rather than twenty live objects.
    const phase = (w.from % 17) * 0.37;
    const breath =
      0.5 + 0.5 * Math.sin(at * (RATE[w.kind] ?? RATE.severe) + phase);
    return {
      state,
      fill: lo + (hi - lo) * breath,
      line: 0.62 + 0.33 * breath,
      width: w.kind === "severe" ? 1.2 : 1.8,
      colour,
    };
  }

  if (state === "expiring") {
    const f = 1 - (at - w.to) / EXPIRY_FADE;
    const [lo] = FILL[w.kind] ?? FILL.severe;
    return { state, fill: lo * f, line: 0.18 + 0.44 * f, width: 1, colour };
  }

  // Expired: a hairline that says a warning was here, dimming the whole time
  // it lingers so the oldest is always the faintest thing on the map.
  const age = (at - w.to - EXPIRY_FADE) / (LINGER - EXPIRY_FADE);
  return { state, fill: 0, line: 0.18 * (1 - age), width: 1, colour };
}

// ---------------------------------------------------------------------------
// Lead time (Z1 #09)
// ---------------------------------------------------------------------------

/**
 * Ray casting, on the outer ring.
 *
 * Warning polygons are small, simple and convex-ish, so nothing cleverer is
 * warranted. The half-open rule on the y comparison is what stops a point
 * exactly level with a vertex being counted twice.
 */
export function inRing(
  lon: number,
  lat: number,
  ring: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export interface InsideSpan {
  from: number;
  to: number;
  kind: WarnKind;
  label: string;
}

/**
 * When the chaser was actually inside a warning — the warning lane's data.
 *
 * Not the same thing as when a warning was in force: most of the polygons on
 * a chase day cover ground the chaser never drove. The lane is only useful if
 * it reports the intersection of the two, which is what turns it into a
 * lead-time answer.
 *
 * Sampled at `stepSeconds` rather than per track point, because a 12,000-point
 * track against 74 polygons is a million containment tests for a result that
 * changes on the scale of minutes.
 */
export function insideSpans(
  track: Track,
  warns: readonly WarningPolygonInput[],
  window: readonly [number, number],
  stepSeconds = 15,
): InsideSpan[] {
  const out: InsideSpan[] = [];
  const [t0, t1] = window;

  for (const w of warns) {
    const from = Math.max(t0, w.from);
    const to = Math.min(t1, w.to);
    if (to <= from) continue;

    let openAt: number | null = null;
    let last = from;
    for (let t = from; t <= to + stepSeconds; t += stepSeconds) {
      const clamped = Math.min(t, to);
      const p = track.positionAt(clamped);
      const hit = inRing(p.lon, p.lat, w.ring);
      if (hit && openAt === null) openAt = clamped;
      if (!hit && openAt !== null) {
        out.push({ from: openAt, to: last, kind: w.kind, label: w.label });
        openAt = null;
      }
      last = clamped;
      if (clamped === to) break;
    }
    if (openAt !== null)
      out.push({ from: openAt, to, kind: w.kind, label: w.label });
  }

  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/**
 * Lead time on one tornado: how long the chaser had been inside a tornado
 * warning when it touched down.
 *
 * Returns null when they were not under one — which is the answer that
 * matters most, and the one a tool that only reports positive numbers hides.
 */
export function leadTimeAt(
  touchdown: number,
  spans: readonly InsideSpan[],
): number | null {
  let best: number | null = null;
  for (const s of spans) {
    if (s.kind === "severe") continue;
    if (touchdown >= s.from && touchdown <= s.to) {
      const lead = touchdown - s.from;
      if (best === null || lead > best) best = lead;
    }
  }
  return best;
}
