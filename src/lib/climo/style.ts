/** Climatology map ramp and season lines; editable in admin → Map & data colors (`climo:*`). */
export const CLIMO_RAMP = [
  { key: "c1", label: "Low", color: "#1e3a8a" },
  { key: "c2", label: "", color: "#0ea5e9" },
  { key: "c3", label: "", color: "#22c55e" },
  { key: "c4", label: "", color: "#facc15" },
  { key: "c5", label: "High", color: "#ef4444" },
] as const;
/** Lightning climatology: night blue through violet and magenta to a white-hot core. */
export const CLIMO_LIGHT = [
  { key: "l1", label: "Lightning: rare", color: "#1b1f4b" },
  { key: "l2", label: "Lightning step 2", color: "#5b2a9e" },
  { key: "l3", label: "Lightning step 3", color: "#c026d3" },
  { key: "l4", label: "Lightning step 4", color: "#fb923c" },
  { key: "l5", label: "Lightning: most", color: "#fff7c2" },
] as const;
export const CLIMO_LINES = [
  { key: "atl", label: "Atlantic", color: "#38bdf8" },
  { key: "epac", label: "Eastern Pacific", color: "#f472b6" },
  { key: "sig", label: "EF2+ tornadoes", color: "#f97316" },
] as const;
