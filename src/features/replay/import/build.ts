/**
 * Turning an uploaded file into a chase the app can replay.
 *
 * This is the last link. The parsers already read the file, `sources.ts`
 * already goes and gets the day's tornadoes, and the vault already feeds the
 * switcher — what was missing was the piece that turns one into the other, and
 * without it there was no way for anyone to add a chase at all.
 */
import type { ChasePayload } from "@/features/replay/core/chase";
import { metresToMiles, haversine } from "@/features/replay/core/geo";
import { zoneAt } from "@/features/replay/core/timezone";
import type { DiscoveryBundle } from "./sources";
import type { Fix, ParsedTrack } from "./types";
import { ImportError } from "./types";

/** A fix further from the last one than this, in a single step, is a jump. */
const JUMP_METRES = 30_000;

export interface TrackSummary {
  /** Epoch seconds of the first and last fix. */
  from: number;
  to: number;
  fixes: number;
  miles: number;
  /** The IANA zone the track sits in, for every clock in the app. */
  tz: string;
  /** What the day is called in the chase's own timezone — '2024-03-14'. */
  day: string;
  /** Anything the reader should be told before they commit to this. */
  warnings: string[];
}

/**
 * Read a parsed track well enough to show someone what they just dropped in.
 *
 * Deliberately done before any network call. A file with no timestamps, or one
 * covering four days, cannot have tornadoes found for it, and telling someone
 * that immediately is better than telling them after a slow round trip to a
 * government server.
 */
export function summarise(parsed: ParsedTrack): TrackSummary {
  const fixes = parsed.fixes;
  if (fixes.length < 2) {
    throw new ImportError(
      "That file has fewer than two usable positions in it.",
      "A chase needs a track. If this is a waypoint file rather than a recorded " +
        "drive, it is the wrong export.",
    );
  }

  const warnings = [...parsed.notes];
  const from = fixes[0]![0];
  const to = fixes[fixes.length - 1]![0];

  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw new ImportError(
      "That track has no usable timestamps.",
      "Every fix needs a time — without one there is no clock to replay against, " +
        "and no way to know which day’s tornadoes to look for.",
    );
  }

  let metres = 0;
  let jumps = 0;
  for (let i = 1; i < fixes.length; i += 1) {
    const d = haversine(
      fixes[i - 1]![1],
      fixes[i - 1]![2],
      fixes[i]![1],
      fixes[i]![2],
    );
    // A jump is almost always a GPS dropout being bridged, or two separate
    // drives in one file. Counted and reported rather than silently smoothed.
    if (d > JUMP_METRES) jumps += 1;
    metres += d;
  }
  if (jumps) {
    warnings.push(
      `${jumps} large jump${jumps === 1 ? "" : "s"} in the track — probably a GPS ` +
        "dropout, or two drives saved in one file.",
    );
  }

  const days = (to - from) / 86_400;
  if (days > 1.5) {
    warnings.push(
      `This track covers ${days.toFixed(1)} days. Only tornadoes within a few hours ` +
        "of it will be found.",
    );
  }

  const zone = zoneAt(fixes[0]![1], fixes[0]![2]);
  const tz = zone ?? "America/Chicago";
  if (!zone) {
    warnings.push(
      "This track is outside the area the timezone map covers, so times are shown " +
        "in Central. Everything else is unaffected.",
    );
  }

  return {
    from,
    to,
    fixes: fixes.length,
    miles: metresToMiles(metres),
    tz,
    day: new Date(from * 1000).toLocaleDateString("en-CA", { timeZone: tz }),
    warnings,
  };
}

/**
 * A stable id for an imported chase.
 *
 * The day it happened, because that is what a chaser calls it and what makes
 * the switcher readable. A suffix is added only when the same day is imported
 * twice, so the common case stays "2024-03-14" rather than a hash nobody can
 * read.
 */
export function chaseId(day: string, taken: readonly string[]): string {
  if (!taken.includes(day)) return day;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${day}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${day}-${Date.now()}`;
}

export interface BuildInput {
  parsed: ParsedTrack;
  summary: TrackSummary;
  found: DiscoveryBundle;
  title: string;
  subtitle?: string;
  /** Which of the found tornadoes to keep, by index. All of them by default. */
  keep?: readonly number[];
}

/**
 * Assemble the payload.
 *
 * Every time in here is seconds from T0, which is the first fix. That one
 * convention is what lets the map, the scrub bar, the warning lane, the hail
 * and the funnels share a single clock, and it is the thing most worth getting
 * right: an offset computed against the wrong origin is a bug that looks like
 * a rendering fault.
 */
export function buildPayload(input: BuildInput): ChasePayload {
  const { parsed, summary, found, title, subtitle, keep } = input;
  const T0 = summary.from;

  const kept = keep
    ? [...keep].sort((a, b) => a - b)
    : found.tornadoes.map((_, i) => i);
  const keptSet = new Set(kept);
  // Dropping a tornado renumbers the rest, so everything that points at one by
  // index has to be renumbered with it. Getting this wrong would attach a
  // town's damage to the wrong tornado, silently.
  const reindex = new Map<number, number>();
  kept.forEach((old, next) => reindex.set(old, next));

  const track: [number, number, number][] = parsed.fixes.map((f: Fix) => [
    Math.round((f[0] - T0) * 10) / 10,
    Math.round(f[1] * 1e5) / 1e5,
    Math.round(f[2] * 1e5) / 1e5,
  ]);

  const payload: ChasePayload = {
    title,
    tz: summary.tz,
    T0,
    track,
    torn: kept.map((i) => found.tornadoes[i]!),
    dpts: found.damage
      .filter((d) => keptSet.has(d[6]))
      .map(
        (d) =>
          [d[0], d[1], d[2], d[3], d[4], d[5], reindex.get(d[6])!] as typeof d,
      ),
    polys: found.contours
      .filter((c) => keptSet.has(c.t))
      .map((c) => ({ ...c, t: reindex.get(c.t)! })),
    hail: found.hail,
    warns: found.warnings,
    notes: [
      `Imported from ${parsed.format.toUpperCase()} on ` +
        `${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}.`,
      ...found.notes,
    ],
  };
  if (subtitle) payload.subtitle = subtitle;
  return payload;
}

/** A first suggestion for what to call this, which the reader can change. */
export function suggestTitle(
  found: DiscoveryBundle,
  summary: TrackSummary,
): string {
  const strongest = [...found.tornadoes].sort(
    (a, b) =>
      (Number(b.ef.replace("EF", "")) || -1) -
      (Number(a.ef.replace("EF", "")) || -1),
  )[0];
  if (strongest) return strongest.name;
  return new Date(summary.from * 1000).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: summary.tz,
  });
}
