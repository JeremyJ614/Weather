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
