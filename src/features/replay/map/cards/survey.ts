/**
 * The survey report, assembled from what the survey actually said.
 *
 * The NWS publishes a narrative for nearly every tornado it surveys — where it
 * touched down, which street it crossed, what it took the roof off — and this
 * app carried that text in its data model for weeks without ever putting it on
 * a screen. That is the worst kind of missing feature: the work of getting the
 * data was already done, and the reader still could not read it.
 *
 * The damage breakdown beside it is computed from the survey's own points
 * rather than summarised by hand, so it cannot drift away from what the map
 * is drawing.
 */
import { EF_ORDER } from "@/features/replay/core/chase";
import type { PreparedTornado } from "@/features/replay/core/chase";
import type { Replayable } from "../replayable";

export interface DamageTally {
  ef: string;
  count: number;
}

export interface SurveyReport {
  tornado: PreparedTornado;
  /** Damage points attributed to this tornado, strongest rating first. */
  tally: DamageTally[];
  total: number;
  /** The worst single thing the survey recorded, and where it sat on the scale. */
  worst: { ef: string; what: string; degree: string; wind: number } | null;
  /** What kinds of structure it hit, commonest first — at most six. */
  structures: { what: string; count: number }[];
}

/**
 * Damage-point ratings that are not tornado ratings.
 *
 * A survey logs straight-line wind damage alongside the tornado's own, tagged
 * `TSTM/WIND` rather than an EF number. It belongs on the map — it is real
 * damage — but it is not part of this tornado's rating and must not be counted
 * into the tally as though it were an EF0.
 */
const NON_EF = new Set(["TSTM/WIND", "TSTM", "WIND", ""]);

/** The DAT spells it 'TSTM/Wind' in some exports and 'TSTM/WIND' in others. */
export const isNonEf = (ef: string) => NON_EF.has(ef.toUpperCase().trim());

export function surveyReport(
  r: Replayable,
  index: number,
): SurveyReport | null {
  const tornado = r.tornadoes[index];
  if (!tornado) return null;

  const counts = new Map<string, number>();
  const structures = new Map<string, number>();
  let worst: SurveyReport["worst"] = null;
  let total = 0;

  for (const [, , ef, wind, what, degree, ti] of r.damage) {
    if (ti !== index) continue;
    total += 1;
    counts.set(ef, (counts.get(ef) ?? 0) + 1);
    if (what) structures.set(what, (structures.get(what) ?? 0) + 1);

    // "Worst" is decided on the rating first and the wind estimate second,
    // because two EF2 points are not equally bad and the wind is the survey's
    // own tie-break.
    const better =
      !worst ||
      (EF_ORDER[ef] ?? -2) > (EF_ORDER[worst.ef] ?? -2) ||
      ((EF_ORDER[ef] ?? -2) === (EF_ORDER[worst.ef] ?? -2) &&
        wind > worst.wind);
    if (better && !isNonEf(ef)) worst = { ef, what, degree, wind };
  }

  const tally = [...counts.entries()]
    .map(([ef, count]) => ({ ef, count }))
    .sort((a, b) => (EF_ORDER[b.ef] ?? -2) - (EF_ORDER[a.ef] ?? -2));

  const top = [...structures.entries()]
    .map(([what, count]) => ({ what, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { tornado, tally, total, worst, structures: top };
}

/**
 * Strip the structure code the survey appends in brackets.
 *
 * The raw values read "Small Barns or Farm Outbuildings (SBO)" — the code is
 * how the damage indicator is identified in the DAT and means nothing to a
 * reader, so it comes off for display and stays in the data.
 */
export const plainStructure = (what: string) =>
  what.replace(/\s*\([A-Z0-9/]+\)\s*$/, "").trim();
