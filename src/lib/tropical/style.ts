/** Saffir-Simpson buckets (wind in knots) and outlook/warning colors; editable in Map & data colors. */
export const INTENSITY = [
  { key: "TD", label: "Depression", short: "TD", min: 0, color: "#8fa3bf" },
  {
    key: "TS",
    label: "Tropical Storm",
    short: "TS",
    min: 34,
    color: "#5b9dd9",
  },
  { key: "C1", label: "Category 1", short: "Cat 1", min: 64, color: "#d9b775" },
  { key: "C2", label: "Category 2", short: "Cat 2", min: 83, color: "#e0954e" },
  { key: "C3", label: "Category 3", short: "Cat 3", min: 96, color: "#d96a45" },
  {
    key: "C4",
    label: "Category 4",
    short: "Cat 4",
    min: 113,
    color: "#c1443f",
  },
  {
    key: "C5",
    label: "Category 5",
    short: "Cat 5",
    min: 137,
    color: "#9b3a6b",
  },
] as const;
export type Tier = (typeof INTENSITY)[number];

/** Seven-day formation chance areas (NHC's low/medium/high). */
export const RISK: Record<string, string> = {
  low: "#f2d74e",
  medium: "#f29a3a",
  high: "#e5484d",
};
/** Coastal watches and warnings (NHC tcww codes). */
export const WATCH: Record<string, { label: string; color: string }> = {
  HWR: { label: "Hurricane Warning", color: "#e5484d" },
  HWA: { label: "Hurricane Watch", color: "#f472b6" },
  TWR: { label: "Tropical Storm Warning", color: "#3b82f6" },
  TWA: { label: "Tropical Storm Watch", color: "#facc15" },
};
export const CONE = "#e8e9f0";

export function tierOf(kt: number): Tier {
  let hit: Tier = INTENSITY[0];
  for (const t of INTENSITY) if (kt >= t.min) hit = t;
  return hit;
}

export const mph = (kt: number) => Math.round(kt * 1.15078);

/** Full storm-type name from NHC's classification code. */
export function classLabel(code: string, kt: number): string {
  switch (code.toUpperCase()) {
    case "HU":
    case "MH":
      return kt >= 64 ? `${tierOf(kt).label} Hurricane` : "Hurricane";
    case "TS":
      return "Tropical Storm";
    case "TD":
      return "Tropical Depression";
    case "STS":
    case "SS":
      return "Subtropical Storm";
    case "SD":
      return "Subtropical Depression";
    case "PTC":
      return "Potential Tropical Cyclone";
    case "PT":
    case "EX":
      return "Post-Tropical Cyclone";
    case "RM":
    case "LO":
      return "Remnant Low";
    case "DB":
      return "Disturbance";
    default:
      return tierOf(kt).label;
  }
}

export const BASINS = [
  {
    id: "AL",
    name: "Atlantic",
    center: [-62, 24] as [number, number],
    zoom: 2.6,
  },
  {
    id: "EP",
    name: "East Pacific",
    center: [-112, 16] as [number, number],
    zoom: 2.9,
  },
  {
    id: "CP",
    name: "Central Pacific",
    center: [-155, 17] as [number, number],
    zoom: 3,
  },
] as const;
export type BasinId = (typeof BASINS)[number]["id"];

const COMPASS = "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split(
  " ",
);
export const compass = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];
