/**
 * Where the radar comes from, and what it actually is.
 *
 * The owner's requirement (#13) is that radar is optional and never automatic
 * — nothing is fetched until a button is pressed — and (#14) that it is drawn
 * from range-encoded textures decoded on the GPU rather than from somebody
 * else's pre-coloured picture, with the low values muted so a chaser reads
 * structure instead of a green wash.
 *
 * What the public archives will support, having checked rather than assumed
 * -------------------------------------------------------------------------
 * Composite base reflectivity, and it supports it exactly. The Iowa
 * Environmental Mesonet publishes archived NEXRAD composites as 8-bit
 * paletted tiles at a five-minute cadence for any date, and the palette index
 * *is* the measurement: dBZ = -32 + 0.5 x index. The palette is injective and
 * every colour in a tile is an exact entry, so a fetched tile reverses to
 * true reflectivity in half-dBZ steps with nothing lost.
 *
 * The other three products the owner asked for are not there:
 *
 *   * Storm-relative velocity exists per radar site, but as a 15-colour
 *     classified image, not a range encoding — there is no continuous value
 *     to recover, so it cannot be decoded, only re-displayed in somebody
 *     else's classes.
 *   * Base velocity and correlation coefficient are not in the archive at all.
 *   * All three are in NEXRAD Level II, which is on AWS — and every request
 *     for it from here is refused with AccessDenied, listing and objects
 *     alike, with no proxy failure logged. The UCAR and NCEI THREDDS mirrors
 *     answer 404 for the same volumes.
 *
 * So reflectivity is built properly and the rest are shown as unavailable
 * with the reason, rather than as buttons that do nothing.
 */

/** Products the interface offers, and whether this source can actually serve them. */
export interface RadarProduct {
  id: "reflectivity" | "velocity" | "srv" | "cc";
  label: string;
  /** What it tells a chaser. */
  blurb: string;
  available: boolean;
  /** Why not, in plain words, when it is not. */
  why?: string;
}

export const RADAR_PRODUCTS: readonly RadarProduct[] = [
  {
    id: "reflectivity",
    label: "Reflectivity",
    available: true,
    blurb:
      "How much is falling and how big it is. The hook, the core, the whole storm.",
  },
  {
    id: "velocity",
    label: "Velocity",
    available: false,
    blurb: "Which way the air is moving, towards the radar or away from it.",
    why:
      "The archive that covers past dates does not carry it. It is in NEXRAD Level II, " +
      "which refuses every request from this app’s network.",
  },
  {
    id: "srv",
    label: "Storm-relative velocity",
    available: false,
    blurb:
      "Velocity with the storm’s own motion removed, which is what shows rotation.",
    why:
      "The archive has it as a fifteen-colour classified image rather than measurements, " +
      "so there is no value to decode — only somebody else’s colouring to copy.",
  },
  {
    id: "cc",
    label: "Correlation coefficient",
    available: false,
    blurb:
      "How alike the targets are. Where it drops, the tornado is carrying debris.",
    why: "Level II only, and Level II is refused from this app’s network.",
  },
];

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
    return when.toLocaleString("en-US", { ...opts, timeZone: zone });
  } catch {
    // An unknown zone is not worth an empty panel over.
    return when.toLocaleString("en-US", { ...opts, timeZone: "UTC" });
  }
}
