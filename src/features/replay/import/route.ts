/**
 * A chase drawn by hand: the stops a member taps on the map, the time they remember at some
 * of them, and the legs between (snapped to roads by ./routing). Its clock works the way the
 * Log repo's builder retimes a drive: the first and last stops carry the times the chase
 * began and ended, any stop between may carry one too, and between two timed stops the drive
 * runs at one steady pace, so the untimed stops get their times from how far along they are.
 *
 * The result is an ordinary GPS track (a fix every few hundred meters), so it goes through the
 * same survey lookup and replay as a recorded one.
 */
import { haversine } from "@/features/replay/core/geo";
import { offsetMinutes } from "@/features/replay/core/timezone";
import type { RouteLeg } from "./routing";
import type { Fix, ParsedTrack } from "./types";

export type RouteStop = {
  lat: number;
  lon: number;
  /** "HH:MM" local time the member was here, or "" to work it out. */
  clock: string;
};

export type TimedRoute = {
  fixes: Fix[];
  /** Each stop's time (epoch seconds), null where it could not be worked out. */
  times: (number | null)[];
  miles: number;
  /** What stops the route being saved, in words; empty when it is good. */
  problems: string[];
};

export const MAX_STOPS = 60;
/** Faster than this between two timed stops is a typo, not a chase. */
export const MAX_MPH = 100;
/** Fixes are laid along the route at least this often, in meters. */
const STEP_M = 400;
const MILE = 1609.344;

/** A local date and HH:MM in an IANA zone, as epoch seconds; null when either is malformed. */
export function localEpoch(
  date: string,
  clock: string,
  zone: string,
): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const c = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!d || !c || +c[1] > 23 || +c[2] > 59) return null;
  const asUtc = Date.UTC(+d[1], +d[2] - 1, +d[3], +c[1], +c[2]) / 1000;
  // Twice, so an instant either side of a daylight-saving change lands on the right offset.
  let t = asUtc - offsetMinutes(zone, new Date(asUtc * 1000)) * 60;
  t = asUtc - offsetMinutes(zone, new Date(t * 1000)) * 60;
  return t;
}

const lengthOf = (g: [number, number][]) => {
  let m = 0;
  for (let i = 1; i < g.length; i += 1)
    m += haversine(g[i - 1][1], g[i - 1][0], g[i][1], g[i][0]);
  return m;
};

/** Gives every stop a time and lays fixes along the legs; `problems` says what is missing. */
export function timeRoute(
  stops: RouteStop[],
  legs: RouteLeg[],
  date: string,
  zone: string,
): TimedRoute {
  const n = stops.length;
  const times: (number | null)[] = stops.map(() => null);
  const along = [0];
  legs.forEach((l, i) => along.push(along[i] + lengthOf(l.geometry)));
  const miles = (along[along.length - 1] ?? 0) / MILE;
  const problems: string[] = [];
  if (n < 2 || legs.length !== n - 1)
    return {
      fixes: [],
      times,
      miles,
      problems: [
        "Tap the map at least twice: where you set off and where you finished.",
      ],
    };
  if (!stops[0].clock) problems.push("Give stop 1 the time you set off.");
  if (!stops[n - 1].clock)
    problems.push(`Give stop ${n} the time you finished.`);

  // Timed stops in order. A time earlier than the one before is a typo unless it is
  // most of a day earlier, which is the drive going past midnight.
  const pins: number[] = [];
  let prev: number | null = null;
  stops.forEach((s, i) => {
    if (!s.clock) return;
    let t = localEpoch(date, s.clock, zone);
    if (t === null) {
      problems.push(`Stop ${i + 1}'s time isn't a time.`);
      return;
    }
    if (prev !== null && t <= prev) {
      if (prev - t < 12 * 3600) {
        problems.push(
          `Stop ${i + 1} (${s.clock}) is earlier than stop ${pins[pins.length - 1] + 1}.`,
        );
        return;
      }
      t += 86400;
    }
    times[i] = t;
    pins.push(i);
    prev = t;
  });
  if (problems.length) return { fixes: [], times, miles, problems };

  for (let p = 1; p < pins.length; p += 1) {
    const a = pins[p - 1];
    const b = pins[p];
    const ta = times[a]!;
    const tb = times[b]!;
    const span = along[b] - along[a];
    for (let k = a + 1; k < b; k += 1)
      times[k] =
        ta +
        (tb - ta) *
          (span > 0 ? (along[k] - along[a]) / span : (k - a) / (b - a));
    const mph = span / MILE / Math.max(1e-9, (tb - ta) / 3600);
    if (mph > MAX_MPH)
      problems.push(
        `Stop ${a + 1} to stop ${b + 1} is ${Math.round(span / MILE)} mi in ${Math.round((tb - ta) / 60)} min (${Math.round(mph)} mph). Check the times.`,
      );
  }
  if (problems.length) return { fixes: [], times, miles, problems };

  const fixes: Fix[] = [];
  const push = (t: number, lon: number, lat: number) => {
    const last = fixes[fixes.length - 1];
    const f: Fix = [
      Math.round(t),
      Math.round(lat * 1e6) / 1e6,
      Math.round(lon * 1e6) / 1e6,
    ];
    if (last && last[0] === f[0] && last[1] === f[1] && last[2] === f[2])
      return;
    fixes.push(f);
  };
  legs.forEach((leg, i) => {
    const t0 = times[i]!;
    const t1 = times[i + 1]!;
    const g = leg.geometry;
    const total = along[i + 1] - along[i];
    if (i === 0) push(t0, g[0][0], g[0][1]);
    let s = 0;
    for (let j = 1; j < g.length; j += 1) {
      const d = haversine(g[j - 1][1], g[j - 1][0], g[j][1], g[j][0]);
      const steps = Math.max(1, Math.ceil(d / STEP_M));
      for (let k = 1; k <= steps; k += 1) {
        const f = k / steps;
        const at = total > 0 ? (s + d * f) / total : 1;
        push(
          t0 + (t1 - t0) * at,
          g[j - 1][0] + (g[j][0] - g[j - 1][0]) * f,
          g[j - 1][1] + (g[j][1] - g[j - 1][1]) * f,
        );
      }
      s += d;
    }
    // A leg that goes nowhere (waiting at a spot) still moves the clock on.
    if (total === 0) push(t1, g[g.length - 1][0], g[g.length - 1][1]);
  });
  return { fixes, times, miles, problems };
}

/** The drawn route as a track for the importer. */
export function drawnTrack(route: TimedRoute, legs: RouteLeg[]): ParsedTrack {
  const straight = legs.filter((l) => l.snapped === "straight").length;
  return {
    fixes: route.fixes,
    format: "Drawn route",
    notes: straight
      ? [
          `${straight} leg${straight === 1 ? " is" : "s are"} drawn straight: the road router didn't answer, or you chose straight lines.`,
        ]
      : [],
  };
}
