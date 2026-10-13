/**
 * SPC outlook palettes and level mapping, ported exactly from the VIP app
 * (colors and wording as the owner set them there). These are defaults: the
 * admin color editor can override any swatch by key.
 */

export type Level = { color: string; label: string };
export type Kind =
  | "cat"
  | "tornadoLikelihood"
  | "tornadoIntensity"
  | "hailLikelihood"
  | "hailIntensity"
  | "windLikelihood"
  | "windIntensity";

export const SPC_PALETTES: Record<Kind, Level[]> = {
  cat: [
    { color: "#3a4a52", label: "General Thunder" },
    { color: "#83EBF2", label: "Level 1 · Low" },
    { color: "#6395EE", label: "Level 2" },
    { color: "#191970", label: "Level 3" },
    { color: "#560591", label: "Level 4" },
    { color: "#CCCCFF", label: "Level 5 · Extreme" },
  ],
  tornadoLikelihood: [
    { color: "#FFE5EC", label: "Level 1" },
    { color: "#FFB3C6", label: "Level 2 · Possible" },
    { color: "#FF6B8A", label: "Level 3" },
    { color: "#E5383B", label: "Level 4 · Fairly Certain" },
    { color: "#7A0C0C", label: "Level 5 · Bet On It" },
  ],
  tornadoIntensity: [
    { color: "#FFD6E8", label: "Tornado risk area" },
    { color: "#F06BB0", label: "Intensity 1" },
    { color: "#E0218A", label: "Intensity 2" },
    { color: "#8E0F53", label: "Intensity 3 · violent possible" },
  ],
  hailLikelihood: [
    { color: "#F5F5F0", label: "Level 1" },
    { color: "#D6EFFF", label: "Level 2 · Possible" },
    { color: "#2A9DF4", label: "Level 3" },
    { color: "#2647D6", label: "Level 4" },
    { color: "#0A1F5C", label: "Level 5 · Hail Certainty" },
  ],
  hailIntensity: [
    { color: "#CCCCFF", label: "Hail risk area" },
    { color: "#9B7FD4", label: "Intensity 1" },
    { color: "#5B3A8C", label: "Intensity 2" },
  ],
  windLikelihood: [
    { color: "#E8FFE0", label: "Level 1" },
    { color: "#A8E6A1", label: "Level 2 · High Winds Possible" },
    { color: "#5CB85C", label: "Level 3" },
    { color: "#2E8B2E", label: "Level 4" },
    { color: "#0B4D0B", label: "Level 5 · Severe Wind Certain" },
  ],
  windIntensity: [
    { color: "#FDFBD4", label: "Wind risk area" },
    { color: "#E8C14A", label: "Intensity 1" },
    { color: "#DAA520", label: "Intensity 2" },
    { color: "#8A5F0A", label: "Intensity 3 · extreme gusts possible" },
  ],
};

export const KIND_TITLE: Record<Kind, string> = {
  cat: "Threat Level",
  tornadoLikelihood: "Tornado Likelihood",
  tornadoIntensity: "Tornado Intensity",
  hailLikelihood: "Hail Likelihood",
  hailIntensity: "Hail Intensity",
  windLikelihood: "Wind Likelihood",
  windIntensity: "Wind Intensity",
};

/** VIP's five-step severe probability scale (wording kept as the owner set it). */
export const PROB_STEPS = [
  {
    level: 1,
    label: "Very Slim Chance",
    note: "General thunderstorms · under 5% within 25 mi",
    color: "#F3F2ED",
    opacity: 0.14,
  },
  {
    level: 2,
    label: "Slight Possibility",
    note: "SPC Marginal · about 5% within 25 mi",
    color: "#4FFFB0",
    opacity: 0.42,
  },
  {
    level: 3,
    label: "Likely",
    note: "SPC Slight · about 15% within 25 mi",
    color: "#CBA135",
    opacity: 0.52,
  },
  {
    level: 4,
    label: "Near Guaranteed",
    note: "SPC Enhanced · about 30% within 25 mi",
    color: "#C21E56",
    opacity: 0.7,
  },
  {
    level: 5,
    label: "Destructive Storms Guaranteed",
    note: "SPC Moderate or High · 45%+ within 25 mi",
    color: "#353E43",
    opacity: 0.92,
  },
];

export type Hazard = "cat" | "torn" | "hail" | "wind";
const CAT_INDEX: Record<string, number> = {
  TSTM: 0,
  MRGL: 1,
  SLGT: 2,
  ENH: 3,
  MDT: 4,
  HIGH: 5,
};
const CAT_STEP: Record<string, number> = {
  TSTM: 1,
  MRGL: 2,
  SLGT: 3,
  ENH: 4,
  MDT: 5,
  HIGH: 5,
};

/** SPC labels are fractions ("0.05" = 5%). */
export function labelPct(label: string): number | null {
  const f = parseFloat(label);
  if (Number.isNaN(f)) return null;
  return f <= 1 ? Math.round(f * 100) : Math.round(f);
}

/** Probability → VIP level 1–5 (tornado bands differ from wind/hail). */
export function probLevel(hazard: "torn" | "hail" | "wind", pct: number) {
  if (hazard === "torn")
    return pct >= 30 ? 5 : pct >= 15 ? 4 : pct >= 10 ? 3 : pct >= 5 ? 2 : 1;
  return pct >= 60 ? 5 : pct >= 45 ? 4 : pct >= 30 ? 3 : pct >= 15 ? 2 : 1;
}

export const cigOf = (label: string) => {
  const m = /^CIG([123])$/i.exec(label.trim());
  return m ? Number(m[1]) : null;
};

export function kindFor(hazard: Hazard, intensity: boolean): Kind {
  if (hazard === "cat") return "cat";
  const h = hazard === "torn" ? "tornado" : hazard;
  return `${h}${intensity ? "Intensity" : "Likelihood"}` as Kind;
}

/**
 * The palette index for one SPC feature (VIP's levelIndexFor), or null to skip
 * it. Likelihood skips CIG contours; intensity draws the risk area at 0 and
 * each CIG group above it (hail stops at 2).
 */
export function levelIndex(
  hazard: Hazard,
  intensity: boolean,
  label: string,
): number | null {
  const l = label.trim().toUpperCase();
  if (hazard === "cat") return intensity ? null : (CAT_INDEX[l] ?? null);
  const cig = cigOf(l);
  if (intensity) {
    if (cig)
      return Math.min(cig, SPC_PALETTES[kindFor(hazard, true)].length - 1);
    return labelPct(l) === null ? null : 0;
  }
  if (cig) return null;
  const pct = labelPct(l);
  return pct === null ? null : probLevel(hazard, pct) - 1;
}

/** The probability-scale step (1–5) for a Day 1–3 category or a Day 4–8 percent. */
export function probStep(label: string, probabilistic: boolean): number | null {
  if (!probabilistic) return CAT_STEP[label.trim().toUpperCase()] ?? null;
  const pct = labelPct(label);
  if (pct === null) return null;
  return pct >= 45 ? 5 : pct >= 30 ? 4 : pct >= 15 ? 3 : pct >= 5 ? 2 : 1;
}

/** VIP's day labels: Today, Tomorrow, then weekdays. */
export function dayTabs(now: number) {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
    d,
    label:
      d === 1
        ? "Today"
        : d === 2
          ? "Tomorrow"
          : new Date(now + (d - 1) * 86_400_000).toLocaleDateString("en-US", {
              weekday: "short",
            }),
  }));
}
