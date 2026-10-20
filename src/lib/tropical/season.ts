/**
 * A season's storms from NHC's best tracks (ATCF b-decks): each numbered system's track,
 * peak, lowest pressure, dates and accumulated cyclone energy, and the season's totals.
 */
import { coord } from "./atcf";

export type BestPoint = {
  dtg: string;
  lat: number;
  lon: number;
  kt: number;
  mb: number | null;
  type: string;
};
export type SeasonStorm = {
  id: string;
  num: number;
  name: string;
  peakKt: number;
  minMb: number | null;
  /** Peak classification: depression, storm, hurricane or major hurricane. */
  peak: "TD" | "TS" | "HU" | "MH";
  /** First and last tropical (or subtropical) fix, YYYYMMDDHH. */
  first: string;
  last: string;
  ace: number;
  /** [lat, lon, kt] every best-track fix, oldest first. */
  track: [number, number, number][];
};
export type SeasonTotals = {
  storms: number;
  named: number;
  hurricanes: number;
  majors: number;
  ace: number;
};

/** Seasons with best tracks to read: 2004 on (NHC's ATCF archive). */
export const FIRST_SEASON = 2004;
/** Tropical and subtropical cyclone types in a b-deck. */
const TROPICAL = new Set(["TD", "TS", "HU", "TY", "ST", "TC", "SD", "SS"]);
/** Types that count toward ACE: tropical storms and hurricanes. */
const ACE_TYPES = new Set(["TS", "HU", "TY", "ST"]);

/** One storm's best track (one fix per time; wind-radii repeats dropped) and its last name. */
export function parseBest(text: string): { name: string; points: BestPoint[] } {
  const seen = new Set<string>();
  const points: BestPoint[] = [];
  let name = "";
  for (const line of text.split("\n")) {
    const c = line.split(",").map((x) => x.trim());
    if (c.length < 11 || c[4] !== "BEST") continue;
    const n = c[27] ?? "";
    if (n && !/^(INVEST|GENESIS\d*)$/.test(n)) name = n;
    if (seen.has(c[2])) continue;
    const lat = coord(c[6]);
    const lon = coord(c[7]);
    if (lat == null || lon == null) continue;
    seen.add(c[2]);
    const mb = Number(c[9]);
    points.push({
      dtg: c[2],
      lat,
      lon,
      kt: Number(c[8]) || 0,
      mb: mb > 800 && mb < 1100 ? mb : null,
      type: c[10],
    });
  }
  points.sort((a, b) => a.dtg.localeCompare(b.dtg));
  return { name, points };
}

/**
 * A storm's season entry, or null when it was never a tropical or subtropical cyclone (a
 * potential tropical cyclone that didn't develop keeps its number but isn't in a season's
 * count).
 */
export function summariseStorm(id: string, text: string): SeasonStorm | null {
  const { name, points } = parseBest(text);
  const life = points.filter((p) => TROPICAL.has(p.type));
  if (!life.length) return null;
  const peakKt = Math.max(...life.map((p) => p.kt));
  const mbs = life.map((p) => p.mb).filter((m): m is number => m != null);
  const ace =
    points
      .filter(
        (p) =>
          ACE_TYPES.has(p.type) && p.kt >= 35 && /(00|06|12|18)$/.test(p.dtg),
      )
      .reduce((a, p) => a + p.kt * p.kt, 0) / 1e4;
  return {
    id,
    num: Number(id.slice(2, 4)),
    name: name ? name[0] + name.slice(1).toLowerCase() : id.toUpperCase(),
    peakKt,
    minMb: mbs.length ? Math.min(...mbs) : null,
    peak:
      peakKt >= 96 ? "MH" : peakKt >= 64 ? "HU" : peakKt >= 34 ? "TS" : "TD",
    first: life[0].dtg,
    last: life[life.length - 1].dtg,
    ace: Math.round(ace * 10) / 10,
    track: points.map((p) => [p.lat, p.lon, p.kt]),
  };
}

export function seasonTotals(storms: SeasonStorm[]): SeasonTotals {
  return {
    storms: storms.length,
    named: storms.filter((s) => s.peakKt >= 34).length,
    hurricanes: storms.filter((s) => s.peakKt >= 64).length,
    majors: storms.filter((s) => s.peakKt >= 96).length,
    ace: Math.round(storms.reduce((a, s) => a + s.ace, 0) * 10) / 10,
  };
}

/** The b-deck ids (e.g. "al052026") in an ATCF directory listing; invests and tests left out. */
export function deckIds(listing: string, basin: string, year: number) {
  const re = new RegExp(`b(${basin})(\\d{2})(${year})\\.dat(?:\\.gz)?`, "g");
  const ids = new Set<string>();
  for (const m of listing.matchAll(re))
    if (Number(m[2]) >= 1 && Number(m[2]) <= 49)
      ids.add(`${m[1]}${m[2]}${m[3]}`);
  return [...ids].sort();
}
