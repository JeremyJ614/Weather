/** Weather Patterns colors (editable in admin as `pat:<key>`). */
export const PAT_COLORS = [
  { key: "g0", label: "Index: low", color: "#4ade80" },
  { key: "g1", label: "Index: elevated", color: "#fde047" },
  { key: "g2", label: "Index: moderate", color: "#f97316" },
  { key: "g3", label: "Index: high", color: "#ef4444" },
  { key: "g4", label: "Index: extreme", color: "#d946ef" },
  { key: "p15", label: "Days 4–7: 15%", color: "#e6a23c" },
  { key: "p30", label: "Days 4–7: 30%", color: "#dc2626" },
  { key: "torn", label: "Tornado reports", color: "#f87171" },
  { key: "hail", label: "Hail reports", color: "#7dd3fc" },
  { key: "wind", label: "Wind reports", color: "#fbbf24" },
] as const;
export const INDEX_LABELS = ["Low", "Elevated", "Moderate", "High", "Extreme"];
export const indexBand = (score: number) =>
  score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
