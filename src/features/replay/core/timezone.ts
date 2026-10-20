/**
 * Which time zone a position is in.
 *
 * B-009: a chase carried one IANA zone for the whole day. Chases cross zone
 * boundaries all the time — Indiana on a spring setup, the Kansas–Colorado
 * line, the Florida panhandle — and the clock is the centrepiece of this
 * interface. A clock that is an hour wrong for the second half of a chase is
 * worse than no clock.
 *
 * How this works, and how accurate it is
 * --------------------------------------
 * United States zone boundaries are not meridians. They follow state lines,
 * county lines and rivers, so they are curves. Each boundary below is stored
 * as a polyline of (latitude, longitude) vertices; the boundary longitude at a
 * given latitude is interpolated between the two vertices that straddle it,
 * and the position is east or west of that.
 *
 * This is accurate to a few miles along the straight state-line stretches that
 * make up most of the chaseable Plains, and less accurate where a boundary
 * follows a county line that jogs — western Kentucky and Tennessee especially.
 * `nearBoundary` reports when a position is close enough that the answer should
 * not be trusted to the mile, so the interface can say so rather than assert a
 * zone it cannot stand behind.
 *
 * Outside the box this falls back to the chase's own declared zone, which is
 * the behaviour it replaces.
 *
 * The box is a rectangle around the continental United States, so it also
 * covers the southern edge of Canada and the northern edge of Mexico. A
 * position there gets the US zone with the same UTC offset — Eastern for
 * Ottawa, Central for Winnipeg — rather than that country's own IANA
 * identifier. The clock is right; the zone name is the neighbour's. For a
 * chase log that is the useful answer, and it is better than refusing to say.
 */

import { dateFormat } from "./intl";

export type Zone =
  | "America/New_York"
  | "America/Chicago"
  | "America/Denver"
  | "America/Phoenix"
  | "America/Los_Angeles";

/** [latitude, longitude] vertices, north to south. */
type Boundary = [number, number][];

/**
 * Eastern | Central. North to south: the Michigan–Wisconsin line, the corner of
 * Indiana that is Central, the Kentucky and Tennessee splits, the Georgia line,
 * and the Apalachicola River across the Florida panhandle.
 */
const EASTERN_CENTRAL: Boundary = [
  [49.0, -90.0],
  [47.0, -90.2],
  [46.5, -90.4],
  [45.5, -87.6],
  [45.0, -86.9],
  [42.0, -86.8],
  [41.7, -87.2],
  [41.0, -87.5],
  [39.5, -87.5],
  [38.7, -87.6],
  [38.2, -86.9],
  [37.9, -86.5],
  [37.0, -85.9],
  [36.6, -85.4],
  [36.0, -85.3],
  [35.0, -85.4],
  [34.0, -85.4],
  [33.0, -85.1],
  [31.5, -85.1],
  [30.7, -85.0],
  [30.0, -85.0],
  [29.0, -85.0],
  // On down the Gulf, so the Florida peninsula and the Keys read Eastern.
  [24.0, -85.0],
];

/**
 * Central | Mountain. The Dakotas and Nebraska splits, the four Mountain-time
 * counties in western Kansas, and the swing west around the Oklahoma panhandle
 * to the El Paso corner of Texas.
 */
const CENTRAL_MOUNTAIN: Boundary = [
  [49.0, -100.0],
  [47.0, -100.4],
  [46.0, -100.6],
  [45.0, -100.8],
  [43.5, -101.2],
  [42.5, -101.5],
  [41.5, -101.5],
  [40.0, -102.0],
  [39.0, -102.0],
  [37.5, -102.0],
  [36.5, -103.0],
  [35.0, -103.0],
  [33.0, -103.5],
  [32.0, -104.5],
  [31.0, -105.5],
  [29.5, -104.5],
];

/** Mountain | Pacific. Mostly the Idaho, Oregon and Nevada state lines. */
const MOUNTAIN_PACIFIC: Boundary = [
  [49.0, -117.0],
  [47.0, -117.0],
  [45.5, -116.9],
  [45.0, -117.2],
  [44.0, -117.5],
  [43.0, -117.0],
  [42.0, -117.0],
  [41.0, -114.0],
  [40.0, -114.0],
  [38.0, -114.0],
  [36.0, -114.1],
  [34.5, -114.6],
  [33.0, -114.5],
  [32.5, -114.7],
];

/**
 * Arizona keeps Mountain Standard Time all year and does not observe daylight
 * saving, so it is its own zone — except the Navajo Nation, which does.
 */
const ARIZONA = { north: 37.0, south: 31.3, west: -114.9, east: -109.0 };
const NAVAJO = { north: 37.0, south: 35.0, west: -111.6, east: -109.0 };

// A rectangle around the continental United States. It overlaps the Canadian
// and Mexican border regions on purpose — see the note at the top of the file.
const CONUS = { north: 49.5, south: 24.4, west: -125.0, east: -66.9 };

/** The boundary's longitude at a latitude, or null if outside its span. */
function longitudeAt(boundary: Boundary, lat: number): number | null {
  for (let i = 1; i < boundary.length; i += 1) {
    const [latA, lonA] = boundary[i - 1]!;
    const [latB, lonB] = boundary[i]!;
    const hi = Math.max(latA, latB);
    const lo = Math.min(latA, latB);
    if (lat <= hi && lat >= lo) {
      const span = latB - latA;
      if (span === 0) return lonA;
      const f = (lat - latA) / span;
      return lonA + f * (lonB - lonA);
    }
  }
  return null;
}

const inBox = (
  lat: number,
  lon: number,
  b: { north: number; south: number; west: number; east: number },
) => lat <= b.north && lat >= b.south && lon >= b.west && lon <= b.east;

/**
 * The zone at a position, or null outside the continental United States.
 *
 * Null is not a failure: it means this table has nothing to say, and the
 * caller should keep whatever zone it already had.
 */
export function zoneAt(lat: number, lon: number): Zone | null {
  if (!inBox(lat, lon, CONUS)) return null;

  // Arizona first: it is a Mountain-longitude exception, not a boundary case.
  if (inBox(lat, lon, ARIZONA) && !inBox(lat, lon, NAVAJO))
    return "America/Phoenix";

  const ec = longitudeAt(EASTERN_CENTRAL, lat);
  if (ec !== null && lon > ec) return "America/New_York";

  const cm = longitudeAt(CENTRAL_MOUNTAIN, lat);
  if (cm === null || lon > cm) return "America/Chicago";

  const mp = longitudeAt(MOUNTAIN_PACIFIC, lat);
  if (mp === null || lon > mp) return "America/Denver";

  return "America/Los_Angeles";
}

/** Kilometres of longitude per degree at a latitude. */
const kmPerDegreeLon = (lat: number) =>
  111.32 * Math.cos((lat * Math.PI) / 180);

/**
 * True when a position is close enough to a boundary that this table's answer
 * should be shown as approximate rather than asserted.
 */
export function nearBoundary(lat: number, lon: number, withinKm = 40): boolean {
  for (const boundary of [
    EASTERN_CENTRAL,
    CENTRAL_MOUNTAIN,
    MOUNTAIN_PACIFIC,
  ]) {
    const at = longitudeAt(boundary, lat);
    if (at === null) continue;
    if (Math.abs(lon - at) * kmPerDegreeLon(lat) <= withinKm) return true;
  }
  return false;
}

/** Each US zone's letter and its standard offset in hours, for naming the old ones. */
const US_ZONES: Record<string, [string, number]> = {
  "America/New_York": ["E", -5],
  "America/Chicago": ["C", -6],
  "America/Denver": ["M", -7],
  "America/Phoenix": ["M", -7],
  "America/Los_Angeles": ["P", -8],
};

/**
 * Short label for a zone at an instant — CDT, EST, MDT.
 *
 * Browsers only know the names from 1970 on: the Tri-State tornado's 1925
 * afternoon comes back as "GMT-6". For the US zones the name follows from the
 * offset — the standard one is CST, an hour ahead of it CDT — so an archive
 * day reads the way the survey would have written it.
 */
export function zoneAbbreviation(zone: string, at: Date): string {
  try {
    const parts = dateFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const us = US_ZONES[zone];
    const gmt = /^GMT([+-]\d{1,2})$/.exec(name);
    if (us && gmt) {
      const hours = Number(gmt[1]);
      if (hours === us[1]) return `${us[0]}ST`;
      if (hours === us[1] + 1) return `${us[0]}DT`;
    }
    return name;
  } catch {
    return "";
  }
}

/** The offset a zone is at on a given instant, in minutes east of UTC. */
export function offsetMinutes(zone: string, at: Date): number {
  try {
    // Format the instant in the zone, read it back as if it were UTC, and the
    // difference is the offset. Intl has no direct accessor for this.
    const parts = dateFormat("en-CA", {
      timeZone: zone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? 0);
    // Hour 24 means midnight at the end of the day in some implementations.
    const hour = get("hour") % 24;
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      hour,
      get("minute"),
      get("second"),
    );
    return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

export interface ZoneReading {
  zone: string;
  abbreviation: string;
  /** True when the position sits close to a boundary. */
  approximate: boolean;
  /** True when the zone differs from the chase's declared one. */
  changed: boolean;
}

/**
 * What the clock should say at a position, given the chase's declared zone as
 * the fallback for anywhere this table does not cover.
 */
export function readingAt(
  lat: number,
  lon: number,
  declared: string,
  at: Date,
): ZoneReading {
  const found = zoneAt(lat, lon);
  const zone = found ?? declared;
  return {
    zone,
    abbreviation: zoneAbbreviation(zone, at),
    approximate: found !== null && nearBoundary(lat, lon),
    changed: zone !== declared,
  };
}
