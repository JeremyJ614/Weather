import { sunTimes } from "./astro";

/**
 * Daylight Tracker maths (NOAA solar equations, on the device). Everything is
 * keyed to the place's own calendar date and time zone.
 */
const DAY = 86_400_000;

export type SunDay = {
  astroDawn: Date | null;
  nauticalDawn: Date | null;
  civilDawn: Date | null;
  rise: Date | null;
  goldenEnd: Date | null;
  noon: Date | null;
  goldenStart: Date | null;
  set: Date | null;
  civilDusk: Date | null;
  nauticalDusk: Date | null;
  astroDusk: Date | null;
  dayMinutes: number;
};

/** Noon UTC of a local calendar date "YYYY-MM-DD". */
const noonOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`);

export function sunDay(lat: number, lon: number, ymd: string): SunDay {
  const d = noonOf(ymd);
  const main = sunTimes(lat, lon, d);
  const civ = sunTimes(lat, lon, d, 96);
  const nau = sunTimes(lat, lon, d, 102);
  const ast = sunTimes(lat, lon, d, 108);
  const gold = sunTimes(lat, lon, d, 84);
  const noon =
    main.rise && main.set
      ? new Date((main.rise.getTime() + main.set.getTime()) / 2)
      : null;
  return {
    astroDawn: ast.rise,
    nauticalDawn: nau.rise,
    civilDawn: civ.rise,
    rise: main.rise,
    goldenEnd: gold.rise,
    noon,
    goldenStart: gold.set,
    set: main.set,
    civilDusk: civ.set,
    nauticalDusk: nau.set,
    astroDusk: ast.set,
    dayMinutes: main.dayMinutes,
  };
}

export const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Minutes after local midnight for an instant, in a time zone. */
export function localMinutes(t: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(t);
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
  return g("hour") * 60 + g("minute");
}

export type YearDay = {
  ymd: string;
  dayMinutes: number;
  riseMin: number | null;
  setMin: number | null;
};

/** Every day of a year for one place. */
export function yearDays(
  lat: number,
  lon: number,
  year: number,
  timeZone: string,
): YearDay[] {
  const out: YearDay[] = [];
  for (
    let ymd = `${year}-01-01`;
    ymd.startsWith(String(year));
    ymd = addDays(ymd, 1)
  ) {
    const t = sunTimes(lat, lon, noonOf(ymd));
    out.push({
      ymd,
      dayMinutes: t.dayMinutes,
      riseMin: t.rise ? localMinutes(t.rise, timeZone) : null,
      setMin: t.set ? localMinutes(t.set, timeZone) : null,
    });
  }
  return out;
}

/** The year's notable days: shortest and longest, earliest sunset and latest sunrise. */
export function keyDays(days: YearDay[]) {
  const by = (f: (d: YearDay) => number | null, pick: "min" | "max") =>
    days.reduce<YearDay | null>((a, d) => {
      const v = f(d);
      if (v == null) return a;
      const av = a ? f(a) : null;
      return av == null || (pick === "min" ? v < av : v > av) ? d : a;
    }, null);
  return {
    shortest: by((d) => d.dayMinutes, "min"),
    longest: by((d) => d.dayMinutes, "max"),
    earliestSet: by((d) => d.setMin, "min"),
    latestSet: by((d) => d.setMin, "max"),
    earliestRise: by((d) => d.riseMin, "min"),
    latestRise: by((d) => d.riseMin, "max"),
  };
}

/** "11 h 16 m 42 s" style parts from minutes. */
export function hms(minutes: number) {
  const s = Math.round(Math.abs(minutes) * 60);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
