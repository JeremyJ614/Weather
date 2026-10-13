/** Parts of the app the kill switches can turn off. Add each feature here as it is built. */
export const MODULES = [
  { id: "weather", label: "Local forecast (Today card)" },
  { id: "maps", label: "Maps" },
  { id: "news", label: "SSWX News" },
] as const;

export const moduleIds = new Set<string>(MODULES.map((m) => m.id));
