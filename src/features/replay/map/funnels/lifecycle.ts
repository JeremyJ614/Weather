/**
 * How a tornado looks at a moment in its life (Z1 #16, Z3 #11).
 *
 * A tornado is not the same object for its whole time on the ground, and
 * drawing it as one is the single thing that makes a replay look like a
 * diagram. Real ones descend as a funnel, touch down, widen, and then — most
 * of them — narrow, tilt downshear and rope out over a minute or two.
 *
 * This is the pure part: given a rating and where we are in the life, what
 * shape and character should be drawn. The renderer reads it; nothing here
 * touches WebGL, so it can be argued with in a test.
 */

export type Phase = "before" | "forming" | "mature" | "roping" | "after";

export interface Character {
  /** Width at the ground, in metres, before lifecycle scaling. */
  baseWidthM: number;
  /** How far up the condensation reaches, in metres. */
  heightM: number;
  /** 0..1. A violent tornado is a solid object; a weak one is half there. */
  opacity: number;
  /** 0..1. How much darker than the ambient cloud base. */
  darkness: number;
  /** Side-to-side turbulence, in metres. */
  wobbleM: number;
  /** 0..1. Debris cloud at the base — the thing that makes a wedge read as one. */
  debris: number;
  /** Seconds the funnel takes to descend before touchdown. */
  formingSeconds: number;
  /** Seconds spent roping out at the end. */
  ropingSeconds: number;
}

/**
 * Rating drives character, not just colour.
 *
 * An EF5 wedge and an EF0 rope are different objects — one is a mile of
 * rotating debris, the other a translucent thread — and recolouring one sprite
 * says they are the same thing at different temperatures. The numbers below
 * are shaped from the ratings themselves: width from the survey, everything
 * else scaled so the difference reads at a glance.
 */
const CHARACTER: Record<string, Character> = {
  EFU: {
    baseWidthM: 40,
    heightM: 900,
    opacity: 0.34,
    darkness: 0.3,
    wobbleM: 22,
    debris: 0.1,
    formingSeconds: 40,
    ropingSeconds: 40,
  },
  EF0: {
    baseWidthM: 60,
    heightM: 1000,
    opacity: 0.4,
    darkness: 0.34,
    wobbleM: 26,
    debris: 0.14,
    formingSeconds: 45,
    ropingSeconds: 45,
  },
  EF1: {
    baseWidthM: 110,
    heightM: 1150,
    opacity: 0.52,
    darkness: 0.44,
    wobbleM: 30,
    debris: 0.26,
    formingSeconds: 50,
    ropingSeconds: 55,
  },
  EF2: {
    baseWidthM: 210,
    heightM: 1300,
    opacity: 0.64,
    darkness: 0.56,
    wobbleM: 34,
    debris: 0.42,
    formingSeconds: 55,
    ropingSeconds: 65,
  },
  EF3: {
    baseWidthM: 380,
    heightM: 1500,
    opacity: 0.75,
    darkness: 0.66,
    wobbleM: 38,
    debris: 0.58,
    formingSeconds: 60,
    ropingSeconds: 80,
  },
  EF4: {
    baseWidthM: 700,
    heightM: 1700,
    opacity: 0.85,
    darkness: 0.76,
    wobbleM: 42,
    debris: 0.74,
    formingSeconds: 70,
    ropingSeconds: 95,
  },
  EF5: {
    baseWidthM: 1200,
    heightM: 1900,
    opacity: 0.93,
    darkness: 0.84,
    wobbleM: 46,
    debris: 0.88,
    formingSeconds: 80,
    ropingSeconds: 110,
  },
};

export function characterOf(ef: string): Character {
  return CHARACTER[ef.toUpperCase()] ?? CHARACTER.EFU!;
}

export interface LifeState {
  phase: Phase;
  /** 0..1 through the whole life, forming through roping. */
  progress: number;
  /**
   * 0..1 how fully formed the funnel is. Drives width, opacity and how far
   * down the condensation reaches.
   */
  intensity: number;
  /** Multiplier on the surveyed width. */
  widthScale: number;
  /** How far the funnel leans, in radians — a roping tornado is not vertical. */
  tilt: number;
  /** 0..1, non-zero only in the seconds around touchdown (Z3 #15). */
  flash: number;
  /** 0..1 how far the condensation reaches down. Below 1 it has not touched. */
  reach: number;
}

const TOUCHDOWN_FLASH_SECONDS = 2.5;

/**
 * Where a tornado is in its life at a moment.
 *
 * The survey gives a touchdown and a lift, and nothing between. Everything
 * here is a model, not data: the forming phase is drawn BEFORE the surveyed
 * start (the funnel was visibly descending before it was officially a
 * tornado), and the roping phase runs up to the surveyed end. That is honest
 * to how they behave and is the reason a replay reads as weather rather than
 * as a line growing.
 */
export function lifeAt(
  start: number,
  end: number,
  at: number,
  ch: Character,
): LifeState {
  const formStart = start - ch.formingSeconds;
  const ropeStart = Math.max(start, end - ch.ropingSeconds);

  if (at < formStart) {
    return {
      phase: "before",
      progress: 0,
      intensity: 0,
      widthScale: 0,
      tilt: 0,
      flash: 0,
      reach: 0,
    };
  }
  if (at > end) {
    return {
      phase: "after",
      progress: 1,
      intensity: 0,
      widthScale: 0,
      tilt: 0,
      flash: 0,
      reach: 0,
    };
  }

  const progress = clamp01((at - formStart) / Math.max(1, end - formStart));

  // Touchdown flash: brief, centred on the surveyed start.
  const sinceTouchdown = at - start;
  const flash =
    sinceTouchdown >= 0 && sinceTouchdown < TOUCHDOWN_FLASH_SECONDS
      ? 1 - sinceTouchdown / TOUCHDOWN_FLASH_SECONDS
      : 0;

  if (at < start) {
    // Descending. The condensation reaches down but has not arrived.
    const f = clamp01((at - formStart) / Math.max(1, ch.formingSeconds));
    return {
      phase: "forming",
      progress,
      // Eased so it hangs, then drops — a funnel does not descend linearly.
      intensity: f * f * 0.65,
      widthScale: 0.25 + f * 0.45,
      tilt: 0,
      flash: 0,
      reach: f,
    };
  }

  if (at >= ropeStart) {
    const f = clamp01((at - ropeStart) / Math.max(1, end - ropeStart));
    return {
      phase: "roping",
      progress,
      // Fades but does not vanish until the end — a rope is still visible.
      intensity: 1 - f * 0.75,
      // Narrows hard. This is what makes the end read as roping out.
      widthScale: 1 - f * 0.82,
      // Leans further downshear as it goes.
      tilt: f * 0.7,
      flash: 0,
      reach: 1,
    };
  }

  // Mature. Still breathing rather than static: a real one pulses.
  const matureFor = at - start;
  const breathe =
    1 + 0.06 * Math.sin(matureFor / 9) + 0.03 * Math.sin(matureFor / 3.3);
  return {
    phase: "mature",
    progress,
    intensity: 1,
    // Widens over the first half-minute rather than arriving at full size.
    widthScale: Math.min(1, 0.55 + matureFor / 45) * breathe,
    tilt: 0.06 * Math.sin(matureFor / 13),
    flash,
    reach: 1,
  };
}

/** The window a tornado is worth drawing at all, including its forming phase. */
export function visibleWindow(
  start: number,
  end: number,
  ch: Character,
): [number, number] {
  return [start - ch.formingSeconds, end];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * The condensation trail (Z3 #12).
 *
 * How much of a trail is left at a point that was laid down `age` seconds ago.
 * It decays rather than vanishing, so the path a tornado has taken stays
 * readable for a while behind it without becoming a permanent smear.
 */
export function trailOpacity(
  ageSeconds: number,
  lifetimeSeconds = 240,
): number {
  if (ageSeconds < 0 || ageSeconds > lifetimeSeconds) return 0;
  const f = 1 - ageSeconds / lifetimeSeconds;
  // Quadratic: holds near the tornado, drops away quickly behind it.
  return f * f;
}

/**
 * The proximity ring (Z3 #14).
 *
 * Reports how alarming a distance is, so the ring can report rather than
 * decorate. The thresholds are the ones chasers actually use: a mile is
 * close, two miles is comfortable, under a quarter mile is an emergency.
 */
export type Proximity = "safe" | "near" | "close" | "imminent";

export function proximityOf(metres: number): Proximity {
  if (metres <= 402) return "imminent"; // a quarter mile
  if (metres <= 1609) return "close"; // a mile
  if (metres <= 3219) return "near"; // two miles
  return "safe";
}
