/**
 * How sure we are of each Weather Engine (owner, Fix It List #36, 1): five levels, each with
 * a color the owner sets by hex code in admin → Extras, and each engine's level. Shown on the
 * engine's explainer as the Confidence tag, under the Experimental tag. Kept with the Extras
 * switches (the `_confidence` key of the `extras_items` setting), which is public to read
 * and editable by Extras admins.
 */
export const CONF_LEVELS = [
  "No Confidence / New Engine",
  "Low Confidence",
  "Medium Confidence",
  "Highly Confident",
  "Extremely Confident / Tested & Approved",
] as const;

export const CONF_COLORS = [
  "#9aa4b8",
  "#ff7a59",
  "#ffc94d",
  "#4fd6ff",
  "#5ef0a0",
] as const;

/** The Experimental tag's red. */
export const EXPERIMENTAL = "#ff3d4f";

/** Starting levels, from each engine's report card and how proven its method is. */
export const DEFAULT_LEVELS: Record<string, number> = {
  tor: 2,
  surge: 1,
  bound: 2,
  first: 2,
  stp: 0,
  scp: 0,
  dcp: 0,
  ltg: 1,
  llj: 2,
  nst: 0,
  pyro: 1,
  rwrap: 1,
  blizz: 1,
  sunset: 2,
  rainbow: 2,
  deer: 1,
  fish: 1,
  coast: 3,
  tctor: 1,
  blind: 4,
};

export type Confidence = {
  /** Engine id → level (0 to 4). */
  levels: Record<string, number>;
  /** One hex color per level. */
  colors: string[];
};

export const DEFAULT_CONFIDENCE: Confidence = {
  levels: DEFAULT_LEVELS,
  colors: [...CONF_COLORS],
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps only valid levels and colors; anything else falls back to the default. */
export function cleanConfidence(raw: unknown): Confidence {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    levels?: Record<string, unknown>;
    colors?: unknown[];
  };
  const levels = { ...DEFAULT_LEVELS };
  for (const [k, v] of Object.entries(r.levels ?? {}))
    if (k in DEFAULT_LEVELS && Number.isInteger(v) && +v! >= 0 && +v! <= 4)
      levels[k] = v as number;
  const colors = CONF_COLORS.map((d, i) => {
    const c = Array.isArray(r.colors) ? r.colors[i] : null;
    return typeof c === "string" && HEX.test(c) ? c.toLowerCase() : d;
  });
  return { levels, colors };
}

/** An engine's level and its color. */
export function confidenceOf(c: Confidence, id: string) {
  const level = c.levels[id] ?? 0;
  return { level, label: CONF_LEVELS[level], color: c.colors[level] };
}
