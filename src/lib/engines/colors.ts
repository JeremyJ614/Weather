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
export type FieldId =
  | "llj"
  | "nst"
  | "pyro"
  | "tctor"
  | "stp"
  | "scp"
  | "dcp"
  | "ltg"
  | "rwrap"
  | "blizz";
export const FIELD_BANDS: Record<
  FieldId,
  { levels: number[]; labels: string[]; colors: string[] }
> = {
  llj: {
    levels: [15, 30, 45, 60, 75],
    labels: ["Some", "Moderate", "Strong", "Very strong", "Extreme"],
    colors: ["#1e3a8a", "#2563eb", "#22d3ee", "#facc15", "#f43f5e"],
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
  stp: {
    levels: [0.5, 1, 2, 4, 8],
    labels: ["0.5", "1 (significant)", "2", "4", "8+"],
    colors: ["#0ea5e9", "#facc15", "#fb923c", "#f43f5e", "#e879f9"],
  },
  scp: {
    levels: [1, 2, 4, 8, 16],
    labels: ["1 (supercells)", "2", "4", "8", "16+"],
    colors: ["#22c55e", "#facc15", "#fb923c", "#f43f5e", "#c084fc"],
  },
  dcp: {
    levels: [1, 2, 4, 6, 8],
    labels: ["1", "2 (derecho)", "4", "6", "8+"],
    colors: ["#38bdf8", "#818cf8", "#facc15", "#f97316", "#ef4444"],
  },
  ltg: {
    levels: [0.05, 0.25, 1, 2.5, 5],
    labels: ["Isolated", "Scattered", "Frequent", "Intense", "Extreme"],
    colors: ["#fde68a", "#facc15", "#fb923c", "#f472b6", "#f8fafc"],
  },
  rwrap: {
    levels: [1, 35, 55, 75],
    labels: ["Visible (LP)", "Classic", "Heavy rain (HP)", "Rain-wrapped"],
    colors: ["#a3e635", "#facc15", "#38bdf8", "#a855f7"],
  },
  blizz: {
    levels: [1, 3, 6, 12, 24],
    labels: ["1 h", "3 h (blizzard)", "6 h", "12 h", "24 h+"],
    colors: ["#bae6fd", "#60a5fa", "#818cf8", "#c084fc", "#f0abfc"],
  },
};

/** Lightning Surge Detector storm outlines: rising, jump, strong jump. */
export const SURGE_BANDS = [
  { label: "Lightning rising", color: "#fde047" },
  { label: "Lightning jump", color: "#fb923c" },
  { label: "Strong jump", color: "#f43f5e" },
];

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
