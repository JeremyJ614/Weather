import {
  CC_STOPS as CC,
  FOLD,
  VEL_STOPS as VEL,
} from "@/features/replay/palette";
import { chaserStops } from "../decode";

/**
 * The colours for the radar's own moments.
 *
 * One stop list per product, and everything else — the shader's ramp, the
 * legend's gradient, the numbers under it — generated from it, so the scale
 * beside the map cannot drift from the pixels on it.
 */
export type Stop = readonly [
  value: number,
  r: number,
  g: number,
  b: number,
  a: number,
];

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255] as const;
};
const stops = (l: [number, string, number][]): Stop[] =>
  l.map(([v, hex, a]) => [v, ...rgb(hex), a] as const);

/**
 * Radial velocity, metres per second; negative is towards the radar.
 *
 * Greens coming in, reds going out, the convention every chaser reads without
 * thinking. Near zero is a quiet grey so the eye goes to the strong values,
 * and the extremes run to pale aqua and pale pink rather than saturating, so a
 * tight couplet's two cores stand out as the brightest thing on the screen.
 * The colors are the admin's (Map & data colors), read when the layer is built.
 */
export const velocityStops = () => stops(VEL);

/** Range folded: the radar could not tell how far away the return was. */
export const folded = (): readonly [number, number, number, number] => [
  ...rgb(FOLD.color),
  FOLD.alpha,
];

/**
 * Correlation coefficient, 0 to 1.
 *
 * Rain is alike drop to drop and sits at 0.97 and above, drawn in muted
 * wines and mauves, the quietest part of the scale. Hail, the melting layer and the storm's edges fall into the nineties
 * — yellows and oranges. Below about 0.8, next to a velocity couplet, is
 * debris: shingles, insulation and trees lofted by a tornado, and it is drawn
 * in blues so it cannot be missed against everything else.
 */
export const ccStops = () => stops(CC);

export const reflectivityStops = (): readonly Stop[] => chaserStops();

/** A GLSL function `vec4 name(float v)` evaluating a stop list, straight colour (not premultiplied). */
export function rampFunction(name: string, stops: readonly Stop[]): string {
  const f = (n: number) => n.toFixed(4);
  const lines = [`vec4 ${name}(float v) {`];
  lines.push(
    `  if (v <= ${f(stops[0]![0])}) return vec4(${f(stops[0]![1] / 255)}, ${f(stops[0]![2] / 255)}, ${f(stops[0]![3] / 255)}, ${f(stops[0]![4])});`,
  );
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [v0, r0, g0, b0, a0] = stops[i]!;
    const [v1, r1, g1, b1, a1] = stops[i + 1]!;
    lines.push(
      `  if (v < ${f(v1)}) return mix(vec4(${f(r0 / 255)}, ${f(g0 / 255)}, ${f(b0 / 255)}, ${f(a0)}), ` +
        `vec4(${f(r1 / 255)}, ${f(g1 / 255)}, ${f(b1 / 255)}, ${f(a1)}), clamp((v - ${f(v0)}) / ${f(v1 - v0)}, 0.0, 1.0));`,
    );
  }
  const last = stops[stops.length - 1]!;
  lines.push(
    `  return vec4(${f(last[1] / 255)}, ${f(last[2] / 255)}, ${f(last[3] / 255)}, ${f(last[4])});`,
  );
  lines.push("}");
  return lines.join("\n");
}

/** The same ramp on the CPU, for the legend and the tests. */
export function rampAt(
  stops: readonly Stop[],
  v: number,
): { r: number; g: number; b: number; a: number } {
  const first = stops[0]!,
    last = stops[stops.length - 1]!;
  if (v <= first[0])
    return { r: first[1], g: first[2], b: first[3], a: first[4] };
  for (let i = 0; i < stops.length - 1; i += 1) {
    const lo = stops[i]!,
      hi = stops[i + 1]!;
    if (v < hi[0]) {
      const t = Math.max(0, Math.min(1, (v - lo[0]) / (hi[0] - lo[0])));
      const m = (a: number, b: number) => a + (b - a) * t;
      return {
        r: Math.round(m(lo[1], hi[1])),
        g: Math.round(m(lo[2], hi[2])),
        b: Math.round(m(lo[3], hi[3])),
        a: m(lo[4], hi[4]),
      };
    }
  }
  return { r: last[1], g: last[2], b: last[3], a: last[4] };
}

/**
 * A CSS gradient of the ramp from `lo` to `hi`, composited over the map's
 * dark ground the way the pixels are — a swatch at 60 per cent alpha looks
 * nothing like the raw colour.
 */
export function legendGradient(
  stops: readonly Stop[],
  lo: number,
  hi: number,
  steps = 24,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const v = lo + ((hi - lo) * i) / steps;
    const c = rampAt(stops, v);
    const over = (x: number) => Math.round(x * c.a + 20 * (1 - c.a));
    parts.push(
      `rgb(${over(c.r)}, ${over(c.g)}, ${over(c.b)}) ${((i / steps) * 100).toFixed(1)}%`,
    );
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

export const MS_TO_MPH = 2.236936;
