/**
 * NOAA's lightning strike-density classes (strikes per km² per minute × 10³) and the colors
 * its map draws them in, weakest first. We read classes from those colors; the map tiles
 * themselves are NOAA's.
 */
export const LT_CLASSES: { v: number; rgb: [number, number, number] }[] = [
  { v: 0.1, rgb: [255, 255, 204] },
  { v: 0.25, rgb: [255, 236, 120] },
  { v: 0.5, rgb: [255, 255, 0] },
  { v: 0.75, rgb: [255, 214, 0] },
  { v: 1, rgb: [255, 164, 0] },
  { v: 2.5, rgb: [255, 120, 0] },
  { v: 5, rgb: [255, 69, 0] },
  { v: 10, rgb: [255, 0, 0] },
  { v: 15, rgb: [188, 0, 37] },
  { v: 25, rgb: [204, 0, 102] },
  { v: 50, rgb: [255, 0, 255] },
  { v: 75, rgb: [128, 0, 128] },
  { v: 100, rgb: [64, 0, 192] },
  { v: 150, rgb: [0, 0, 255] },
  { v: 200, rgb: [0, 199, 255] },
  { v: 250, rgb: [0, 162, 100] },
  { v: 300, rgb: [0, 255, 0] },
];

/** Our own drawings group the classes into five bands (`lt:*` in admin colors). */
export const LT_BANDS = [
  { key: "light", min: 0, label: "Light", color: "#fde68a" },
  { key: "moderate", min: 4, label: "Moderate", color: "#fb923c" },
  { key: "heavy", min: 7, label: "Heavy", color: "#ef4444" },
  { key: "intense", min: 10, label: "Intense", color: "#d946ef" },
  { key: "extreme", min: 13, label: "Extreme", color: "#38bdf8" },
] as const;
export const ltBand = (cls: number) =>
  [...LT_BANDS].reverse().find((b) => cls >= b.min) ?? LT_BANDS[0];

/** Class index (0–16) for a pixel color, or −1 for no lightning. */
export function classOf(r: number, g: number, b: number, a: number) {
  if (a < 128) return -1;
  let best = -1;
  let bd = 1e9;
  LT_CLASSES.forEach((c, i) => {
    const d = (c.rgb[0] - r) ** 2 + (c.rgb[1] - g) ** 2 + (c.rgb[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return bd < 3000 ? best : -1;
}
