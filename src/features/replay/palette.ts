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

/**
 * Each radar's own scans (Level 2): radial velocity in m/s (negative is towards the radar;
 * greens in, reds out) and correlation coefficient (rain near 1, debris in blues below
 * about 0.8). Value, color, opacity.
 */
export const VEL_STOPS: [number, string, number][] = [
  [-50, "#c4fff6", 0.96],
  [-38, "#16ff8e", 0.94],
  [-26, "#00cc52", 0.92],
  [-15, "#0a8c38", 0.88],
  [-6, "#2a5e36", 0.8],
  [-1.5, "#4c5a50", 0.62],
  [0, "#5c5c5c", 0.55],
  [1.5, "#5a4a4a", 0.62],
  [6, "#6e262c", 0.8],
  [15, "#a81424", 0.88],
  [26, "#ee2230", 0.92],
  [38, "#ff7a9a", 0.94],
  [50, "#ffdcee", 0.96],
];
export const VEL_DEFAULTS = VEL_STOPS.map((s) => s[1]);
export const CC_STOPS: [number, string, number][] = [
  [0.2, "#241646", 0.9],
  [0.45, "#3c2c9a", 0.9],
  [0.6, "#286cdc", 0.9],
  [0.75, "#1ebec8", 0.9],
  [0.85, "#78dc50", 0.88],
  [0.9, "#f0e63c", 0.86],
  [0.94, "#f09632", 0.78],
  [0.97, "#b43c50", 0.62],
  [0.99, "#864682", 0.5],
  [1.05, "#c8b4d2", 0.45],
];
export const CC_DEFAULTS = CC_STOPS.map((s) => s[1]);
/** Range folded: the radar could not tell how far away the return was. */
export const FOLD = { color: "#8a3cbe", default: "#8a3cbe", alpha: 0.82 };

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
  VEL_STOPS.forEach((s, i) => {
    s[1] = pick(colors, `replay:vel:${s[0]}`, VEL_DEFAULTS[i]);
  });
  CC_STOPS.forEach((s, i) => {
    s[1] = pick(colors, `replay:cc:${s[0]}`, CC_DEFAULTS[i]);
  });
  FOLD.color = pick(colors, "replay:folded", FOLD.default);
  return true;
}

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
