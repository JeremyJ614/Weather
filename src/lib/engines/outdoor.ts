/**
 * The outdoor engines' math (Extras): Sunset & Sunrise Quality, Rainbow Chance, Deer Activity
 * and Fishing Bite. Pure functions, shared by the server, the place readouts and the tests.
 * Each score is built from named factors so members' reports can tune how much each counts
 * (`tuned`, from `fitWeights`).
 */
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/** How much each factor counts: 1 is as designed; members' reports move it (0.25–2). */
export type Weights = Record<string, number>;

/* ── Sunset and sunrise ─────────────────────────────────────────────────── */

export type GlowInputs = {
  /** Cloud cover where you stand (%), by layer. */
  low: number;
  mid: number;
  high: number;
  /** Low and mid cloud along the line toward the sun, 60–400 km out (%). */
  path: number[];
  /** Aerosol optical thickness (smoke and haze). */
  aot: number;
  /** Relative humidity at 2 m (%). */
  rh: number;
  /** Rain fell in the two hours before. */
  rained: boolean;
};

/**
 * The parts of a colorful sky: high and mid cloud overhead to catch the light (best near
 * half cover), little low cloud in the way, a clear horizon toward the sun so the light gets
 * under the clouds, a little smoke for deeper reds (heavy smoke dims it), dry air, and the
 * clean air after rain.
 */
export function glowFactors(x: GlowInputs) {
  const cov = Math.min(100, x.high + 0.6 * x.mid);
  const block = x.path.length
    ? x.path.reduce((a, b) => a + b, 0) / x.path.length
    : 0;
  return {
    canvas: cov < 50 ? cov / 50 : 1 - (0.6 * (cov - 50)) / 50,
    under: 1 - (0.8 * x.low) / 100,
    horizon: 1 - block / 100,
    smoke:
      x.aot < 0.1
        ? 1
        : x.aot < 0.5
          ? 1 + (0.25 * (x.aot - 0.1)) / 0.4
          : Math.max(0.4, 1.25 - 0.5 * (x.aot - 0.5)),
    haze: 1 - 0.3 * clamp((x.rh - 60) / 40),
    rain: x.rained && x.low < 40 ? 1.15 : 1,
  };
}
export type GlowFactors = ReturnType<typeof glowFactors>;

/** 0–100: the factors multiplied, each raised to its tuned weight. */
export function glowScore(f: GlowFactors, w: Weights = {}) {
  let s = 100;
  for (const [k, v] of Object.entries(f)) s *= Math.max(0, v) ** (w[k] ?? 1);
  return Math.round(clamp(s, 0, 100));
}

export const GLOW_LABELS = ["Dull", "Fair", "Good", "Great"];

/* ── Rainbows ───────────────────────────────────────────────────────────── */

/**
 * A rainbow needs the sun behind you and low (its arc sits 42° from the point opposite the
 * sun, so above 42° it is below the horizon), rain in front of you, and sunlight reaching the
 * rain. `rain` is how many of the spots checked opposite the sun (5–20 km) have rain on
 * radar (0–4); `sunlit` how open the sky is toward the sun (0–1, from satellite).
 */
export function rainbowChance(sunAlt: number, rain: number, sunlit: number) {
  if (sunAlt <= 0 || sunAlt >= 42) return 0;
  const low = sunAlt < 4 ? sunAlt / 4 : sunAlt > 32 ? (42 - sunAlt) / 10 : 1;
  const wet = [0, 0.55, 0.8, 0.95, 1][Math.max(0, Math.min(4, rain))];
  return Math.round(100 * low * wet * clamp(sunlit));
}

/**
 * Bigger drops make brighter, more vivid bows (post-launch A6 "drop size"): light showers
 * (under 25 dBZ, small drops) count a little less, heavy ones (40 dBZ and up) a little more.
 */
export const dropFactor = (dbz: number) =>
  dbz >= 40 ? 1.1 : dbz >= 25 ? 1 : 0.85;

/** Satellite visible brightness (0–255) to how open the sky is: dark ground 1, bright cloud 0. */
export const openSky = (gray: number) => clamp((150 - gray) / 70);

/* ── Deer ───────────────────────────────────────────────────────────────── */

export type DeerHour = {
  /** Hours from sunrise and from sunset (signed). */
  fromRise: number;
  fromSet: number;
  /** °F against the average of the past week. */
  colder: number;
  /** Pressure change over the last 3 hours (hPa). */
  dp3: number;
  windMph: number;
  rainMm: number;
};

/** Deer move most at dawn and dusk, after a cold snap, as pressure rises behind a front. */
export function deerFactors(x: DeerHour) {
  const peak = (h: number) => Math.exp(-((h / 1.6) ** 2));
  return {
    light: Math.max(0.25, peak(x.fromRise), peak(x.fromSet)),
    cold: clamp(0.5 + x.colder / 20),
    front: clamp(0.5 + x.dp3 / 4),
    wind: 1 - clamp((x.windMph - 10) / 15),
    rain: x.rainMm > 2.5 ? 0.4 : x.rainMm > 0.2 ? 0.85 : 1,
  };
}
/**
 * Research weights (post-launch A6): GPS-collar studies find time of day by far the strongest
 * pull on deer movement, temperature a modest one, wind and rain smaller, and barometric
 * pressure (and the moon, left out) barely any.
 */
const DEER_W = { light: 0.5, cold: 0.2, front: 0.08, wind: 0.14, rain: 0.08 };

/** Where the date sits in the rut: 1 outside it, up to 1.5 at the peak (two weeks). */
export function rutBoost(
  day: Date,
  rut: { pre: string; peak: string; post: string; end: string },
) {
  const t = day.getTime();
  // Windows can cross New Year (a Deep South rut peaks in January): each boundary is the
  // first date on or after the one before it, tried from this year and the last.
  for (const y of [day.getUTCFullYear(), day.getUTCFullYear() - 1]) {
    let prev = -Infinity;
    const at = (md: string) => {
      let x = Date.parse(`${y}-${md}T00:00:00Z`);
      if (x < prev) x = Date.parse(`${y + 1}-${md}T00:00:00Z`);
      prev = x;
      return x;
    };
    const [pre, peak, post, end] = [rut.pre, rut.peak, rut.post, rut.end].map(
      at,
    );
    if (t >= peak && t < post) return 1.5;
    if (t >= pre && t < peak) return 1.25;
    if (t >= post && t < end) return 1.15;
  }
  return 1;
}

export function deerScore(x: DeerHour, rut: number, w: Weights = {}) {
  const f = deerFactors(x);
  let sum = 0;
  let tot = 0;
  for (const [k, base] of Object.entries(DEER_W)) {
    const wk = base * (w[k] ?? 1);
    sum += wk * f[k as keyof typeof f];
    tot += wk;
  }
  // The rut lifts the whole day: outside it the best hour tops out at 80, at the peak 100.
  return Math.round(100 * (sum / tot) * (0.8 + (0.2 * (rut - 1)) / 0.5));
}

/* ── Fishing ────────────────────────────────────────────────────────────── */

export const SPECIES = [
  {
    id: "bass",
    name: "Largemouth bass",
    lo: 60,
    hi: 80,
    cloud: 0.6,
    chop: 0.4,
  },
  { id: "walleye", name: "Walleye", lo: 55, hi: 70, cloud: 0.9, chop: 0.9 },
  { id: "crappie", name: "Crappie", lo: 55, hi: 72, cloud: 0.5, chop: 0.3 },
  {
    id: "catfish",
    name: "Channel catfish",
    lo: 70,
    hi: 85,
    cloud: 0.4,
    chop: 0.2,
  },
  { id: "steelhead", name: "Steelhead", lo: 40, hi: 58, cloud: 0.7, chop: 0.5 },
] as const;
export type SpeciesId = (typeof SPECIES)[number]["id"];

export type FishHour = {
  fromRise: number;
  fromSet: number;
  /** Minutes from the nearest major (moon overhead or underfoot) and minor (rise, set) period. */
  major: number;
  minor: number;
  /** Pressure change over the last 3 hours (hPa). */
  dp3: number;
  windMph: number;
  cloud: number;
  /** Water temperature (°F), measured nearby or estimated. */
  water: number;
};

/**
 * What anglers swear by, scored: low light at dawn and dusk, the moon's major and minor
 * periods, slowly falling pressure ahead of a front (fast rises behind one shut the bite
 * off), a light chop and clouds for the species that like them, and water in the species'
 * comfortable range.
 */
export function fishFactors(x: FishHour, sp: (typeof SPECIES)[number]) {
  const peak = (h: number) => Math.exp(-((h / 1.5) ** 2));
  const p = x.dp3;
  return {
    light: Math.max(0.3, peak(x.fromRise), peak(x.fromSet)),
    moon: Math.max(
      0.3,
      x.major <= 60 ? 1 : x.major <= 120 ? 0.7 : 0.3,
      x.minor <= 30 ? 0.8 : 0.3,
    ),
    pressure:
      p <= -0.5 && p >= -3
        ? 1
        : p < -3
          ? 0.7
          : p >= 1.5
            ? 0.25
            : p >= 0.5
              ? 0.5
              : 0.65,
    wind:
      x.windMph < 3
        ? 1 - 0.4 * sp.chop
        : x.windMph <= 15
          ? 1
          : 1 - clamp((x.windMph - 15) / 15),
    sky: 1 - (1 - x.cloud / 100) * 0.5 * sp.cloud,
    water: clamp(
      1 - Math.max(0, sp.lo - x.water, x.water - sp.hi) / 15,
      0.15,
      1,
    ),
  };
}
const FISH_W = {
  light: 0.2,
  moon: 0.2,
  pressure: 0.25,
  wind: 0.1,
  sky: 0.1,
  water: 0.15,
};

export function fishScore(
  x: FishHour,
  sp: (typeof SPECIES)[number],
  w: Weights = {},
) {
  const f = fishFactors(x, sp);
  let sum = 0;
  let tot = 0;
  for (const [k, base] of Object.entries(FISH_W)) {
    const wk = base * (w[k] ?? 1);
    sum += wk * f[k as keyof typeof f];
    tot += wk;
  }
  return Math.round(100 * (sum / tot));
}

/* ── Tuning from members' reports ───────────────────────────────────────── */

/**
 * Least-squares weights for factor scores against members' ratings (scaled 0–1), by
 * projected gradient descent, kept between 0.25 and 2 and pulled toward 1 (as designed) until
 * there are many reports: with n reports the fit counts n / (n + 50).
 */
export function fitWeights(
  rows: { f: Record<string, number>; y: number }[],
  model: (f: Record<string, number>, w: Weights) => number,
  keys: string[],
) {
  const w: Weights = Object.fromEntries(keys.map((k) => [k, 1]));
  if (rows.length < 10) return w;
  const loss = (ws: Weights) =>
    rows.reduce((a, r) => a + (model(r.f, ws) / 100 - r.y) ** 2, 0) /
    rows.length;
  let step = 0.2;
  for (let it = 0; it < 200; it++) {
    const base = loss(w);
    let moved = false;
    for (const k of keys)
      for (const d of [step, -step]) {
        const t = { ...w, [k]: clamp(w[k] + d, 0.25, 2) };
        if (loss(t) < base - 1e-9) {
          w[k] = t[k];
          moved = true;
          break;
        }
      }
    if (!moved) step /= 2;
    if (step < 0.005) break;
  }
  const trust = rows.length / (rows.length + 50);
  return Object.fromEntries(
    keys.map((k) => [k, Math.round((1 + trust * (w[k] - 1)) * 100) / 100]),
  );
}
