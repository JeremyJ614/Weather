/**
 * Where the radar comes from, and what it actually is.
 *
 * The owner's requirement (#13) is that radar is optional and never automatic
 * — nothing is fetched until a button is pressed — and (#14) that it is drawn
 * from measurements decoded on the GPU rather than from somebody else's
 * pre-coloured picture, with the low values muted so a chaser reads structure
 * instead of a green wash.
 *
 * Two archives, checked rather than assumed
 * -----------------------------------------
 * The national reflectivity mosaic. The Iowa Environmental Mesonet publishes
 * archived NEXRAD composites as 8-bit paletted tiles at a five-minute cadence
 * back to 2010, and the palette index *is* the measurement: dBZ = -32 + 0.5 x
 * index. The palette is injective and every colour in a tile is an exact
 * entry, so a fetched tile reverses to true reflectivity with nothing lost.
 * It covers the whole country at once, which is what it is good for.
 *
 * Each radar's own archive — Level II (#7). Every WSR-88D writes out every
 * scan it makes, gate by gate, and NOAA keeps the lot back to June 1991 in a
 * public bucket that answers any origin. This is the only public source of
 * velocity and of the dual-polarisation moments, so velocity, storm-relative
 * velocity and correlation coefficient come from here, read from the radar
 * nearest the storm (see level2/). It carries reflectivity too — sharper than
 * the mosaic, and for the years the mosaic does not reach.
 *
 * An earlier version of this file said Level II refused every request. That
 * was NOAA's own bucket, which now refuses anonymous reads; Unidata's mirror
 * of it does not.
 */

import { dateFormat } from "@/features/replay/core/intl";

export type RadarProductId = "reflectivity" | "velocity" | "srv" | "cc";

/** Products the interface offers. */
export interface RadarProduct {
  id: RadarProductId;
  label: string;
  /** For the chip. */
  short: string;
  /** What it tells a chaser. */
  blurb: string;
  /** Read from a single radar (Level II) rather than the national mosaic. */
  fromSite: boolean;
}

export const RADAR_PRODUCTS: readonly RadarProduct[] = [
  {
    id: "reflectivity",
    label: "Reflectivity",
    short: "Reflectivity",
    fromSite: false,
    blurb:
      "How much is falling and how big it is. The hook, the core, the whole storm.",
  },
  {
    id: "velocity",
    label: "Velocity",
    short: "Velocity",
    fromSite: true,
    blurb:
      "Which way the air is moving along the beam: green towards the radar, red away. " +
      "Bright green beside bright red is rotation.",
  },
  {
    id: "srv",
    label: "Storm-relative velocity",
    short: "Storm-relative",
    fromSite: true,
    blurb:
      "Velocity with the storm\u2019s own motion taken out, so only the circulation is left. " +
      "What chasers read for a tornado.",
  },
  {
    id: "cc",
    label: "Correlation coefficient",
    short: "Correlation",
    fromSite: true,
    blurb:
      "How alike the targets are. Rain is near 1; where it drops below 0.8 beside a couplet, " +
      "the tornado is lofting debris.",
  },
];

/** Level II begins here; the radars went in over the following six years. */
export const LEVEL2_BEGINS = Date.UTC(1991, 5, 1) / 1000;

/** The network was upgraded to dual polarisation, and so to correlation, over 2011 to 2013. */
export const DUAL_POL_BEGINS = Date.UTC(2011, 0, 1) / 1000;

export const coveredByLevel2 = (epochSeconds: number) =>
  epochSeconds >= LEVEL2_BEGINS && epochSeconds < Date.now() / 1000;

/** IEM's archived composite tiles, keyed on a five-minute timestamp. */
const TILES = "https://mesonet.agron.iastate.edu/c/tile.py/1.0.0";

/**
 * The archive's cadence. Asking for 19:47 gets nothing; asking for 19:45 gets
 * the scan that covers it.
 */
export const CADENCE_SECONDS = 300;

/** Snap an epoch to the five-minute slot the archive actually holds. */
export function snapToScan(epochSeconds: number): number {
  return Math.floor(epochSeconds / CADENCE_SECONDS) * CADENCE_SECONDS;
}

/** IEM's timestamp form: YYYYMMDDHHMM, in UTC. */
export function stampFor(epochSeconds: number): string {
  const d = new Date(snapToScan(epochSeconds) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  );
}

/** The tile URL template for a moment, as MapLibre and the loader both want it. */
export function tileTemplate(epochSeconds: number): string {
  return `${TILES}/ridge::USCOMP-N0Q-${stampFor(epochSeconds)}/{z}/{x}/{y}.png`;
}

export function tileUrl(
  epochSeconds: number,
  z: number,
  x: number,
  y: number,
): string {
  return `${TILES}/ridge::USCOMP-N0Q-${stampFor(epochSeconds)}/${z}/${x}/${y}.png`;
}

/**
 * How far back the archive goes.
 *
 * IEM's composite archive begins in 1995, but the five-minute national
 * composite in this form starts later. Asking for 1974 returns blank tiles
 * rather than an error, which would look like "no storms" — so the interface
 * refuses instead of showing an empty sky over the Super Outbreak.
 */
export const ARCHIVE_BEGINS = Date.UTC(2010, 0, 1) / 1000;

export const coveredByArchive = (epochSeconds: number) =>
  epochSeconds >= ARCHIVE_BEGINS && epochSeconds < Date.now() / 1000;

/**
 * The scan time, written the way the clock beside it is written.
 *
 * Radar archives are keyed in UTC and this used to print that, so reading the
 * panel meant converting in your head from whatever the clock said. It takes
 * the zone the clock is reading in instead.
 *
 * Spelled out in components on purpose: Intl throws if `timeZoneName` is
 * combined with `dateStyle`/`timeStyle` rather than ignoring it, and an
 * earlier version caught that and fell back to UTC — printing the exact thing
 * it was written to stop printing.
 */
export function scanLabel(epoch: number, zone: string): string {
  const when = new Date(snapToScan(epoch) * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return dateFormat("en-US", { ...opts, timeZone: zone }).format(when);
  } catch {
    // An unknown zone is not worth an empty panel over.
    return dateFormat("en-US", { ...opts, timeZone: "UTC" }).format(when);
  }
}
