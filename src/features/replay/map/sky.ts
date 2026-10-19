/**
 * The sky, graded to the chase's own time of day (Z3 #21), and the distance
 * haze that sells the perspective (Z3 #20).
 *
 * A dusk chase should look like dusk. That is not a preset: it is the solar
 * altitude at the chaser's latitude and longitude at the replay's own
 * timestamp, which is a number this module computes. 10 March 2026 at Kankakee
 * ends after dark; 14 March 2024 at Indian Lake runs through sunset. Those are
 * different skies, and picking one "evening" gradient for both would flatten
 * the one thing that makes a replay feel like the day it was.
 *
 * The solar position is the NOAA algorithm, which is accurate to well under a
 * degree over any span this app cares about. Everything here is pure: given a
 * timestamp and a place it returns the same sky, so scrubbing backwards gives
 * back the light you had.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SolarPosition {
  /** Degrees above the horizon. Negative below it. */
  altitude: number;
  /** Degrees clockwise from north. */
  azimuth: number;
  /** The sun's declination that day, in degrees. */
  declination: number;
}

/**
 * Where the sun is, from the NOAA solar position equations.
 *
 * `epochSeconds` is a real UTC timestamp, not a replay offset — the whole
 * point is to use the actual instant the chase happened.
 */
export function solarPosition(
  epochSeconds: number,
  lat: number,
  lon: number,
): SolarPosition {
  // Julian day, then Julian century from J2000.0.
  const jd = epochSeconds / 86400 + 2440587.5;
  const jc = (jd - 2451545) / 36525;

  const meanLong = mod360(280.46646 + jc * (36000.76983 + jc * 0.0003032));
  const meanAnom = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccent = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);

  const centre =
    Math.sin(meanAnom * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * meanAnom * RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * meanAnom * RAD) * 0.000289;

  const trueLong = meanLong + centre;
  const appLong =
    trueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * jc) * RAD);

  const meanObliq =
    23 +
    (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos((125.04 - 1934.136 * jc) * RAD);

  const declination =
    Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD)) * DEG;

  // The equation of time: the difference between clock noon and solar noon,
  // which swings by a quarter of an hour across the year and is the reason a
  // sundial disagrees with a watch.
  const varY = Math.tan((obliq / 2) * RAD) ** 2;
  const eqTime =
    4 *
    DEG *
    (varY * Math.sin(2 * meanLong * RAD) -
      2 * eccent * Math.sin(meanAnom * RAD) +
      4 *
        eccent *
        varY *
        Math.sin(meanAnom * RAD) *
        Math.cos(2 * meanLong * RAD) -
      0.5 * varY * varY * Math.sin(4 * meanLong * RAD) -
      1.25 * eccent * eccent * Math.sin(2 * meanAnom * RAD));

  const minutesUtc = (((epochSeconds % 86400) + 86400) % 86400) / 60;
  const trueSolarMinutes = (minutesUtc + eqTime + 4 * lon + 1440) % 1440;
  const hourAngle =
    trueSolarMinutes / 4 < 0
      ? trueSolarMinutes / 4 + 180
      : trueSolarMinutes / 4 - 180;

  const zenith =
    Math.acos(
      clamp(
        Math.sin(lat * RAD) * Math.sin(declination * RAD) +
          Math.cos(lat * RAD) *
            Math.cos(declination * RAD) *
            Math.cos(hourAngle * RAD),
        -1,
        1,
      ),
    ) * DEG;

  const altitude = 90 - zenith;

  // Azimuth, measured clockwise from north.
  let azimuth: number;
  const denom = Math.cos(lat * RAD) * Math.sin(zenith * RAD);
  if (Math.abs(denom) < 1e-9) {
    azimuth = hourAngle > 0 ? 180 : 0;
  } else {
    const c = clamp(
      (Math.sin(lat * RAD) * Math.cos(zenith * RAD) -
        Math.sin(declination * RAD)) /
        denom,
      -1,
      1,
    );
    azimuth =
      hourAngle > 0
        ? mod360(Math.acos(c) * DEG + 180)
        : mod360(540 - Math.acos(c) * DEG);
  }

  return { altitude, azimuth, declination };
}

export type SkyPhase =
  | "night" // no usable light
  | "astronomical" // -18 .. -12
  | "nautical" // -12 .. -6
  | "civil" // -6 .. 0  — the deep blue after sunset
  | "golden" // 0 .. 8   — low, warm, long shadows
  | "day"; //  > 8

export function phaseOf(altitude: number): SkyPhase {
  if (altitude > 8) return "day";
  if (altitude > 0) return "golden";
  if (altitude > -6) return "civil";
  if (altitude > -12) return "nautical";
  if (altitude > -18) return "astronomical";
  return "night";
}

type RGB = readonly [number, number, number];

/**
 * The anchors the gradient is built from, keyed by solar altitude.
 *
 * Deliberately not saturated: this is the ground a storm is read against, and
 * a postcard sunset behind a tornado track is a lie about how the sky looked
 * and a distraction from the data. These are the real colours of a storm day —
 * bruised, flat, heavy — stepped dark enough that the EF palette and the
 * warning polygons stay the brightest things on screen.
 */
interface Anchor {
  altitude: number;
  sky: RGB;
  horizon: RGB;
  fog: RGB;
  /** The cloud base the funnels are lit by — see FunnelLayer's u_cloud. */
  cloud: RGB;
}

const ANCHORS: readonly Anchor[] = [
  // Deep night. Not black: a storm night has city glow and lightning in it.
  {
    altitude: -24,
    sky: [0.02, 0.03, 0.05],
    horizon: [0.05, 0.06, 0.09],
    fog: [0.04, 0.05, 0.07],
    cloud: [0.14, 0.15, 0.19],
  },
  // Astronomical twilight — the first suggestion of a horizon.
  {
    altitude: -15,
    sky: [0.03, 0.04, 0.08],
    horizon: [0.08, 0.09, 0.14],
    fog: [0.06, 0.07, 0.11],
    cloud: [0.19, 0.2, 0.25],
  },
  // Nautical: the blue hour proper.
  {
    altitude: -9,
    sky: [0.05, 0.07, 0.13],
    horizon: [0.14, 0.14, 0.22],
    fog: [0.1, 0.11, 0.17],
    cloud: [0.26, 0.27, 0.33],
  },
  // Civil twilight: the band of ember along the horizon under a dark dome.
  {
    altitude: -3,
    sky: [0.08, 0.1, 0.17],
    horizon: [0.34, 0.22, 0.2],
    fog: [0.18, 0.15, 0.17],
    cloud: [0.36, 0.33, 0.35],
  },
  // Sunset / sunrise.
  {
    altitude: 0,
    sky: [0.13, 0.15, 0.22],
    horizon: [0.52, 0.31, 0.23],
    fog: [0.27, 0.21, 0.2],
    cloud: [0.46, 0.4, 0.39],
  },
  // Golden hour, with the light still low and warm.
  {
    altitude: 6,
    sky: [0.2, 0.24, 0.31],
    horizon: [0.55, 0.42, 0.32],
    fog: [0.35, 0.31, 0.29],
    cloud: [0.58, 0.52, 0.47],
  },
  // Mid-morning / late afternoon.
  {
    altitude: 20,
    sky: [0.27, 0.33, 0.41],
    horizon: [0.48, 0.48, 0.48],
    fog: [0.4, 0.41, 0.43],
    cloud: [0.62, 0.63, 0.65],
  },
  // High sun. Flat, bright, hazy — a plains afternoon before it goes up.
  {
    altitude: 60,
    sky: [0.33, 0.41, 0.5],
    horizon: [0.56, 0.58, 0.6],
    fog: [0.48, 0.5, 0.53],
    cloud: [0.68, 0.7, 0.73],
  },
];

export interface SkyGrade {
  phase: SkyPhase;
  altitude: number;
  azimuth: number;
  "sky-color": string;
  "horizon-color": string;
  "fog-color": string;
  "sky-horizon-blend": number;
  "horizon-fog-blend": number;
  "fog-ground-blend": number;
  "atmosphere-blend": number;
  /** The cloud-base colour the funnel shader reads, 0..1 per channel. */
  cloud: RGB;
}

/**
 * The sky and the distance haze for one moment.
 *
 * `fog-ground-blend` is the depth cue (Z3 #20). It is atmospheric haze rather
 * than an optical blur, and the difference is worth stating plainly: a real
 * depth-of-field pass means copying the framebuffer to a texture every frame
 * and blurring it, which on a phone costs more than the funnels do. Haze
 * achieves what the effect is *for* — distance reads as distance, and the tile
 * seams at the horizon disappear into it — for nothing, because MapLibre is
 * already compositing the sky.
 */
export function skyGrade(altitude: number, azimuth = 180): SkyGrade {
  const { sky, horizon, fog, cloud } = interpolate(altitude);
  const phase = phaseOf(altitude);

  // Night needs a tighter horizon blend or the whole dome washes grey; day can
  // afford a soft one. The haze thickens as the light drops, which is both
  // true of real evenings and useful, because it hides the far ground exactly
  // when the basemap is least readable anyway.
  const t = clamp((altitude + 12) / 30, 0, 1);

  return {
    phase,
    altitude,
    azimuth,
    "sky-color": hex(sky),
    "horizon-color": hex(horizon),
    "fog-color": hex(fog),
    "sky-horizon-blend": 0.4 + 0.45 * t,
    "horizon-fog-blend": 0.25 + 0.4 * t,
    // The depth cue. Lower means the haze reaches further in toward the
    // camera, which is what a heavy, humid storm day actually looks like.
    "fog-ground-blend": 0.55 + 0.3 * t,
    "atmosphere-blend": 0.6 + 0.35 * t,
    cloud,
  };
}

/** The whole grade for a replay instant, from the real timestamp and place. */
export function skyAt(
  epochSeconds: number,
  lat: number,
  lon: number,
): SkyGrade {
  const sun = solarPosition(epochSeconds, lat, lon);
  return skyGrade(sun.altitude, sun.azimuth);
}

function interpolate(altitude: number): {
  sky: RGB;
  horizon: RGB;
  fog: RGB;
  cloud: RGB;
} {
  const first = ANCHORS[0]!;
  const last = ANCHORS[ANCHORS.length - 1]!;
  if (altitude <= first.altitude) return first;
  if (altitude >= last.altitude) return last;

  for (let i = 1; i < ANCHORS.length; i += 1) {
    const a = ANCHORS[i - 1]!;
    const b = ANCHORS[i]!;
    if (altitude > b.altitude) continue;
    const f = (altitude - a.altitude) / (b.altitude - a.altitude);
    return {
      sky: mix(a.sky, b.sky, f),
      horizon: mix(a.horizon, b.horizon, f),
      fog: mix(a.fog, b.fog, f),
      cloud: mix(a.cloud, b.cloud, f),
    };
  }
  return last;
}

function mix(a: RGB, b: RGB, f: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

function hex(c: RGB): string {
  const part = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(c[0])}${part(c[1])}${part(c[2])}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function mod360(v: number): number {
  return ((v % 360) + 360) % 360;
}
