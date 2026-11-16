/** Earth Watch colors (editable in admin → Map & data colors). Client-safe. */
export const EARTH_KINDS = [
  { id: "cyclone", label: "Tropical cyclones", color: "#a78bfa" },
  { id: "flood", label: "Floods", color: "#38bdf8" },
  { id: "fire", label: "Wildfires", color: "#fb923c" },
  { id: "volcano", label: "Volcanoes", color: "#f43f5e" },
  { id: "dust", label: "Dust storms", color: "#d6a35c" },
  { id: "ice", label: "Sea ice and icebergs", color: "#bae6fd" },
  { id: "quake", label: "Earthquakes", color: "#facc15" },
  { id: "drought", label: "Droughts", color: "#c08457" },
] as const;
export const EARTH_LEVELS = [
  { label: "Minor", color: "#22c55e" },
  { label: "Moderate", color: "#a3e635" },
  { label: "Serious", color: "#facc15" },
  { label: "Severe", color: "#fb923c" },
  { label: "Extreme", color: "#f43f5e" },
];
