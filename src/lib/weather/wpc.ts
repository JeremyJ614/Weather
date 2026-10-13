/** WPC rainfall graphics, loaded straight from WPC (nothing is stored on our side). */
const Q = "https://www.wpc.ncep.noaa.gov/qpf/";
export const WPC_QPF = [
  { id: "d1", label: "Day 1", src: `${Q}fill_94qwbg.gif` },
  { id: "d2", label: "Day 2", src: `${Q}fill_98qwbg.gif` },
  { id: "d3", label: "Day 3", src: `${Q}fill_99qwbg.gif` },
  { id: "d4", label: "Day 4", src: `${Q}day4p24iwbg_fill.gif` },
  { id: "d5", label: "Day 5", src: `${Q}day5p24iwbg_fill.gif` },
  { id: "d6", label: "Day 6", src: `${Q}day6p24iwbg_fill.gif` },
  { id: "d7", label: "Day 7", src: `${Q}day7p24iwbg_fill.gif` },
  { id: "t2", label: "1–2 days", src: `${Q}d12_fill.gif` },
  { id: "t3", label: "1–3 days", src: `${Q}d13_fill.gif` },
  { id: "t5", label: "1–5 days", src: `${Q}p120i.gif` },
  { id: "t7", label: "1–7 days", src: `${Q}p168i.gif` },
] as const;

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
