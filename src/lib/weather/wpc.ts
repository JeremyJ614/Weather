/** HeatRisk forecast days: one slice per day at the service's valid times. */
export function heatRiskDays(
  extent: [number, number] | null,
  now = Date.now(),
): number[] {
  if (!extent) return [];
  const out: number[] = [];
  for (let t = extent[0]; t <= extent[1] && out.length < 7; t += 86400000)
    out.push(t);
  return out.filter((t) => t + 86400000 > now || out.length <= 1);
}

export const HEATRISK_LEVELS = [
  { label: "Little to none", color: "#7fd27f" },
  { label: "Minor", color: "#f5e663" },
  { label: "Moderate", color: "#f5a742" },
  { label: "Major", color: "#e8423a" },
  { label: "Extreme", color: "#b5179e" },
];
