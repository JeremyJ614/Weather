/** Climatology map ramp and season lines; editable in admin → Map & data colors (`climo:*`). */
export const CLIMO_RAMP = [
  { key: "c1", label: "Low", color: "#1e3a8a" },
  { key: "c2", label: "", color: "#0ea5e9" },
  { key: "c3", label: "", color: "#22c55e" },
  { key: "c4", label: "", color: "#facc15" },
  { key: "c5", label: "High", color: "#ef4444" },
] as const;
export const CLIMO_LINES = [
  { key: "atl", label: "Atlantic", color: "#38bdf8" },
  { key: "epac", label: "Eastern Pacific", color: "#f472b6" },
  { key: "sig", label: "EF2+ tornadoes", color: "#f97316" },
] as const;
