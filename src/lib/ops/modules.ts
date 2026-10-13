/** Parts of the app the kill switches can turn off. Add each feature here as it is built. */
export const MODULES = [
  { id: "weather", label: "Local forecast (Today card)" },
  { id: "dashboard", label: "Dashboard" },
  { id: "brief", label: "Daily Brief" },
  { id: "discussion", label: "Forecast Discussion" },
  { id: "air", label: "AQI & Pollen" },
  { id: "mosquito", label: "Mosquito Index" },
  { id: "maps", label: "Maps" },
  { id: "weather-news", label: "Weather News" },
  { id: "news", label: "SSWX News" },
] as const;

export const moduleIds = new Set<string>(MODULES.map((m) => m.id));
