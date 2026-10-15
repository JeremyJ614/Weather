/** Camera kinds; colors editable in admin → Map & data colors (`cam:*`). */
export const CAM_KINDS = [
  { key: "traffic", label: "Traffic", color: "#38bdf8" },
  { key: "weather", label: "Road weather", color: "#a3e635" },
  { key: "fire", label: "Wildfire", color: "#f97316" },
] as const;
export type CamKind = (typeof CAM_KINDS)[number]["key"];

export const CAM_SOURCES: Record<string, string> = {
  caltrans: "Caltrans",
  nyc: "NYC DOT",
  iadot: "Iowa DOT",
  trafficwise: "INDOT / KYTC TrafficWise",
  alertca: "ALERTCalifornia (UC San Diego)",
};

/**
 * Traffic Cameras stay owner-only until the owner approves them for members (Phase 48).
 * Opening them is this one switch plus `adminOnly` on the menu entry.
 */
export const CAMS_OPEN = false;
