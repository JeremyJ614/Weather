/** CPC hazard types (by label keywords) and US Drought Monitor categories; editable colors. */
export const HAZ_KINDS: Record<string, { label: string; color: string }> = {
  heat: { label: "Heat", color: "#f97316" },
  cold: { label: "Cold", color: "#60a5fa" },
  wind: { label: "High winds", color: "#c084fc" },
  snow: { label: "Snow & ice", color: "#e0f2fe" },
  rain: { label: "Heavy rain", color: "#22c55e" },
  flood: { label: "Flooding", color: "#14b8a6" },
  drought: { label: "Drought & fire", color: "#b45309" },
  waves: { label: "High waves", color: "#38bdf8" },
  other: { label: "Other", color: "#fbbf24" },
};

/** "Much Below Normal Temperatures" → "cold", "Flooding Possible" → "flood". */
export function hazardKind(label: string): string {
  const l = label.toLowerCase();
  if (/flood/.test(l)) return "flood";
  if (/drought|wildfire|fire/.test(l)) return "drought";
  if (/snow|ice|freez|frost/.test(l)) return "snow";
  if (/heat|above normal temp|much above/.test(l)) return "heat";
  if (/cold|below normal temp|much below/.test(l)) return "cold";
  if (/wind/.test(l)) return "wind";
  if (/wave|surf/.test(l)) return "waves";
  if (/precip|rain/.test(l)) return "rain";
  return "other";
}

export const USDM: { code: string; label: string; color: string }[] = [
  { code: "D0", label: "Abnormally dry", color: "#ffff00" },
  { code: "D1", label: "Moderate drought", color: "#fcd37f" },
  { code: "D2", label: "Severe drought", color: "#ffaa00" },
  { code: "D3", label: "Extreme drought", color: "#e60000" },
  { code: "D4", label: "Exceptional drought", color: "#730000" },
];
