/** WPC's odds categories for snow and ice (editable colors) and the amounts it gives odds for. */
export const PROB = [
  { label: "Slight (10–39%)", color: "#7dd3fc" },
  { label: "Moderate (40–69%)", color: "#3b82f6" },
  { label: "High (70%+)", color: "#a855f7" },
];
export type ProbKind = "snow4" | "snow8" | "snow12" | "ice";
export const PROB_KINDS: Record<ProbKind, { label: string; offset: number }> = {
  snow4: { label: '4"+ snow', offset: 1 },
  snow8: { label: '8"+ snow', offset: 2 },
  snow12: { label: '12"+ snow', offset: 3 },
  ice: { label: '¼"+ ice', offset: 4 },
};
/** Winter NWS alerts, most serious first. */
export const WINTER_EVENTS = [
  "Blizzard Warning",
  "Ice Storm Warning",
  "Winter Storm Warning",
  "Lake Effect Snow Warning",
  "Extreme Cold Warning",
  "Wind Chill Warning",
  "Winter Storm Watch",
  "Extreme Cold Watch",
  "Winter Weather Advisory",
  "Cold Weather Advisory",
  "Wind Chill Advisory",
  "Freeze Warning",
  "Freeze Watch",
  "Frost Advisory",
];
