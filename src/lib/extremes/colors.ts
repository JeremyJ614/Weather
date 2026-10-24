/** Climate Extremes colors (editable in admin → Map & data colors, group "extremes"). */
export const EXTREME_COLORS = [
  { key: "high", label: "Record high · hottest", color: "#ff5a4f" },
  { key: "low", label: "Record low · coldest", color: "#5aa8ff" },
  { key: "warmLow", label: "Warmest low", color: "#ff9f43" },
  { key: "coldHigh", label: "Coldest high", color: "#7fd8ff" },
  { key: "rain", label: "Record rainfall · most humid", color: "#3ddc97" },
  { key: "snow", label: "Record snowfall", color: "#e8ecff" },
  { key: "gust", label: "Strongest gust", color: "#c79bff" },
  { key: "pressure", label: "Lowest pressure", color: "#ffd166" },
] as const;
export type ExtremeKey = (typeof EXTREME_COLORS)[number]["key"];
