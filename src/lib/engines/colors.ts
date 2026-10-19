/** Engine colors (editable in admin → Map & data colors). Client-safe. */
export const TOR_BINS = [
  { min: 3, label: "3–9%", color: "#7dd3fc" },
  { min: 10, label: "10–29%", color: "#facc15" },
  { min: 30, label: "30–59%", color: "#fb923c" },
  { min: 60, label: "60%+", color: "#f43f5e" },
];
export const torBin = (p: number) =>
  Math.max(
    0,
    TOR_BINS.findLastIndex((b) => p >= b.min),
  );
export const HAIL_BANDS = [
  { label: "Severe hail possible (15%+)", color: "#38bdf8" },
  { label: '1" (quarter) +', color: "#4ade80" },
  { label: '1.75" (golf ball) +', color: "#facc15" },
  { label: '2.5" (tennis ball) +', color: "#f43f5e" },
];
export const BLIND_BANDS = [
  { label: "Out of radar range", color: "#475569" },
  { label: "Under 2,000 ft", color: "#22c55e" },
  { label: "2,000–4,000 ft", color: "#a3e635" },
  { label: "4,000–6,000 ft", color: "#facc15" },
  { label: "6,000–10,000 ft", color: "#fb923c" },
  { label: "Over 10,000 ft", color: "#8b5cf6" },
];

/**
 * The model-driven engines (Extras → Weather Engines): each field's band edges, legend labels
 * and default colors, one color per band. Editable as `engine:<id>:<band>`.
 */
export type FieldId = "llj" | "snsq" | "nst" | "pyro" | "tctor";
export const FIELD_BANDS: Record<
  FieldId,
  { levels: number[]; labels: string[]; colors: string[] }
> = {
  llj: {
    levels: [15, 30, 45, 60, 75],
    labels: ["Some", "Moderate", "Strong", "Very strong", "Extreme"],
    colors: ["#1e3a8a", "#2563eb", "#22d3ee", "#facc15", "#f43f5e"],
  },
  snsq: {
    levels: [1, 2, 4, 6, 8],
    labels: ["Possible (1+)", "2+", "4+", "6+", "8+ whiteout"],
    colors: ["#64748b", "#93c5fd", "#e0f2fe", "#c084fc", "#f472b6"],
  },
  nst: {
    levels: [0.5, 1, 2, 3, 5],
    labels: ["0.5", "1 (favorable)", "2", "3", "5+"],
    colors: ["#155e75", "#14b8a6", "#a3e635", "#facc15", "#f97316"],
  },
  pyro: {
    levels: [50, 75, 100, 150, 250],
    labels: ["50", "75", "100 (critical)", "150", "250+"],
    colors: ["#713f12", "#b45309", "#f59e0b", "#ef4444", "#e879f9"],
  },
  tctor: {
    levels: [0.5, 1, 2, 4, 8],
    labels: ["Low", "Marginal", "Elevated", "High", "Very high"],
    colors: ["#1e3a8a", "#0ea5e9", "#facc15", "#f97316", "#ef4444"],
  },
};

/** Rotation Track Persistence: 60-minute peak low-level rotation, ×10⁻³ s⁻¹. */
export const ROT_BANDS = [
  { min: 4, label: "Weak", color: "#38bdf8" },
  { min: 6, label: "Moderate", color: "#facc15" },
  { min: 8, label: "Strong", color: "#fb923c" },
  { min: 11, label: "Intense", color: "#f43f5e" },
  { min: 15, label: "Extreme", color: "#e879f9" },
];
export const rotBin = (v: number) =>
  Math.max(
    0,
    ROT_BANDS.findLastIndex((b) => v >= b.min),
  );
/** PyroCb chance per fire, 0–100. */
export const PYRO_BINS = [
  { min: 0, label: "Low", color: "#64748b" },
  { min: 20, label: "Elevated", color: "#f59e0b" },
  { min: 40, label: "High", color: "#ef4444" },
  { min: 65, label: "Very high", color: "#e879f9" },
];
export const pyroBin = (v: number) =>
  Math.max(
    0,
    PYRO_BINS.findLastIndex((b) => v >= b.min),
  );
