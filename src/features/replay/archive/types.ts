/**
 * The Historical Archive: named events, loaded one at a time.
 *
 * Events rather than days. It used to be days, and opening "Joplin" gave you
 * every tornado in the United States that afternoon, one of them in Minnesota.
 */
import type {
  DamageContour,
  DamagePoint,
  HailReport,
  WarningPolygonInput,
} from "@/features/replay/core/chase";

export interface ArchiveIndexEntry {
  id: string;
  name: string;
  region: string;
  blurb: string;
  /** 'F' for days rated on the Fujita scale, 'EF' from 2007. An F5 and an
   *  EF5 are not the same measurement and are not displayed as if they were. */
  scale: "F" | "EF";
  count: number;
  strongest: string;
  fatalities: number;
  source: "surveyed" | "reconstructed";
}

export interface ArchiveTornado {
  name: string;
  ef: string;
  start: number;
  end: number;
  coords: [number, number][];
  lengthMi: number;
  widthYd: number;
  inj: number;
  fat: number;
  state: string;
  /** How the path was arrived at — shown, never hidden. */
  geometry: "endpoints" | "point" | "reconstructed" | "surveyed";
  /** The survey's own account, where one was published. */
  comments?: string;
  /** The office that surveyed it. */
  wfo?: string;
  /** Peak estimated wind, where the survey gave one. */
  maxwind?: number;
  timing: string;
  waypoints?: { name: string; at: number }[];
}

export interface ArchiveEvent {
  id: string;
  name: string;
  region: string;
  blurb: string;
  scale: "F" | "EF";
  tz: string;
  T0: number;
  source: string;
  pathFidelity: string;
  caveat?: string;
  assumedSpeedMph?: number;
  torn: ArchiveTornado[];
  /**
   * The survey, where the Damage Assessment Toolkit has it.
   *
   * Added by `scripts/build_dat_archive.py`, which is why they are all
   * optional: DAT's coverage begins around 2002 and is patchy until about
   * 2019, so a 1974 event has none of this and a 2024 event has all of it.
   * Absent means the archive genuinely holds nothing, never that it was not
   * asked for.
   */
  polys?: DamageContour[];
  dpts?: DamagePoint[];
  hail?: HailReport[];
  warns?: WarningPolygonInput[];
}

/**
 * Ratings are stored on the EF scale and displayed on the day's own scale.
 *
 * The Fujita scale ran until 1 February 2007; the Enhanced Fujita scale after.
 * Showing a 1974 tornado as "EF5" would be a small lie about how it was rated.
 */
export function ratingLabel(ef: string, scale: "F" | "EF"): string {
  if (ef === "EFU") return scale === "F" ? "unrated" : "EFU";
  return scale === "F" ? ef.replace("EF", "F") : ef;
}

/** Plain-language note for how a track was arrived at. */
export function fidelityNote(t: ArchiveTornado): string | null {
  if (t.geometry === "reconstructed")
    return "Reconstructed from documented waypoints";
  if (t.geometry === "point")
    return "Touchdown point only — path direction inferred";
  if (t.geometry === "surveyed") return null;
  return null;
}
