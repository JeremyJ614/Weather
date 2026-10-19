import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";

/**
 * The replay's map colors (admin → Map & data colors). The map layers, funnels and radar read
 * these objects when they build their paint, so `applyPalette` runs before the map mounts.
 */
export const PAL = {
  ef: { ...EF_COLORS } as Record<string, string>,
  warn: { severe: "#c8a23a", tornado: "#d2564e", emergency: "#e07ab0" },
  hail: { small: "#8a8f96", mid: "#c4cbd2", big: "#ffffff" },
  prox: {
    safe: "#a6dcb2",
    near: "#cfe08f",
    close: "#e8cf9a",
    imminent: "#e5a8bc",
  } as Record<string, string>,
  track: {
    done: "#c9bfa9",
    rest: "#5c6772",
    trail: "#e8d6a5",
    chaser: "#e3e9f1",
  },
};
export const DEFAULTS = structuredClone(PAL);

/** Chaser radar ramp: dBZ, color, opacity. */
export const RADAR_STOPS: [number, string, number][] = [
  [-10, "#3a4048", 0],
  [5, "#4a525c", 0.1],
  [15, "#5a6876", 0.24],
  [20, "#507484", 0.38],
  [30, "#22ac4c", 0.66],
  [40, "#ddc02c", 0.86],
  [50, "#cf4216", 0.91],
  [60, "#961c88", 0.94],
  [70, "#f2e4ff", 0.97],
  [80, "#ffffff", 1],
];
export const RADAR_DEFAULTS = RADAR_STOPS.map((s) => s[1]);

export function applyPalette(colors: Colors) {
  for (const k of Object.keys(EF_COLORS))
    PAL.ef[k] = pick(colors, `ef:${k}`, EF_COLORS[k]);
  const d = DEFAULTS;
  for (const k of ["severe", "tornado", "emergency"] as const)
    PAL.warn[k] = pick(colors, `replay:warn:${k}`, d.warn[k]);
  for (const k of ["small", "mid", "big"] as const)
    PAL.hail[k] = pick(colors, `replay:hail:${k}`, d.hail[k]);
  for (const k of Object.keys(d.prox))
    PAL.prox[k] = pick(colors, `replay:prox:${k}`, d.prox[k]);
  for (const k of ["done", "rest", "trail", "chaser"] as const)
    PAL.track[k] = pick(colors, `replay:track:${k}`, d.track[k]);
  RADAR_STOPS.forEach((s, i) => {
    s[1] = pick(colors, `replay:radar:${s[0]}`, RADAR_DEFAULTS[i]);
  });
  return true;
}

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
