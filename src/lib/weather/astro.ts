/** Sunrise/sunset (NOAA solar equations) and moon phase, computed on the device. */
const rad = Math.PI / 180;

function dayOfYear(d: Date) {
  return Math.floor(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), 0, 0)) /
      86400000,
  );
}

/** Sunrise and sunset for the UTC calendar date of `date`, as Dates; null when the sun never rises/sets. */
export function sunTimes(
  lat: number,
  lon: number,
  date: Date,
): { rise: Date | null; set: Date | null; dayMinutes: number } {
  const n = dayOfYear(date);
  const g = ((2 * Math.PI) / 365) * (n - 1 + 0.5);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const cosHa =
    Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) -
    Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa > 1) return { rise: null, set: null, dayMinutes: 0 };
  if (cosHa < -1) return { rise: null, set: null, dayMinutes: 1440 };
  const ha = Math.acos(cosHa) / rad;
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const riseMin = 720 - 4 * (lon + ha) - eqTime;
  const setMin = 720 - 4 * (lon - ha) - eqTime;
  return {
    rise: new Date(midnight + riseMin * 60000),
    set: new Date(midnight + setMin * 60000),
    dayMinutes: setMin - riseMin,
  };
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/** 0 = new, 0.5 = full. */
export function moonPhase(date: Date) {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  const phase = (((days / SYNODIC) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const names = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  const name = names[Math.round(phase * 8) % 8];
  const daysToFull = ((0.5 - phase + 1) % 1) * SYNODIC;
  return { phase, illumination, name, daysToFull };
}
