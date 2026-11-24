/**
 * The 7-day rain and snow maps' numbers and colors. Each pixel of a frame is a gray code
 * (scripts/build-sevenday.py); this turns codes back into inches and into the map's colors,
 * which the owner can edit (admin → Map & data colors → 7-day rain / 7-day snow).
 */
import { pick, type Colors } from "@/lib/colors/pick";

export type Kind = "rain" | "snow";
/** [first code, last code, inches per code, inches before the first]. */
export type CodeTable = [number, number, number, number][];

/** Inches at every code (index 0 is none). */
export function codeValues(table: CodeTable) {
  const v = new Float32Array(256);
  for (const [c0, c1, step, base] of table)
    for (let c = c0; c <= c1; c++) v[c] = base + (c - c0 + 1) * step;
  return v;
}

/** Color stops, inches and the default color, light amounts first. */
export const STOPS: Record<Kind, { at: number; def: string }[]> = {
  rain: [
    { at: 0.01, def: "#0b3d5c" },
    { at: 0.5, def: "#0f7ea3" },
    { at: 1, def: "#19b3b0" },
    { at: 2, def: "#3ccf74" },
    { at: 4, def: "#e9dc4c" },
    { at: 8, def: "#f7953a" },
    { at: 12, def: "#ef4a4f" },
    { at: 16, def: "#de46b8" },
    { at: 24, def: "#f6c2ff" },
  ],
  snow: [
    { at: 0.1, def: "#22416f" },
    { at: 1, def: "#2f78cf" },
    { at: 3, def: "#57abf7" },
    { at: 6, def: "#8b85f2" },
    { at: 12, def: "#b65ce6" },
    { at: 18, def: "#e04fb5" },
    { at: 24, def: "#ff7fa9" },
    { at: 36, def: "#ffd3ec" },
    { at: 48, def: "#ffffff" },
  ],
};

/** Legend ticks (inches). */
export const TICKS: Record<Kind, number[]> = {
  rain: [0.25, 1, 2, 4, 8, 16, 24],
  snow: [1, 3, 6, 12, 24, 48],
};

export const NOUN: Record<Kind, string> = { rain: "rain", snow: "snow" };

/** The stops in the owner's colors. */
export function stops(kind: Kind, colors: Colors) {
  return STOPS[kind].map((s, i) => ({
    at: s.at,
    color: pick(colors, `seven:${kind}:${i}`, s.def),
  }));
}

/** Report markers and the labels over the map. */
export function markColors(colors: Colors) {
  return {
    flood: pick(colors, "seven:report:flood", "#58e1ff"),
    snow: pick(colors, "seven:report:snow", "#f4f8ff"),
    max: pick(colors, "seven:max", "#ffe08a"),
  };
}

const hex = (c: string) => {
  const m = c.replace("#", "");
  const n = parseInt(
    m.length === 3
      ? m
          .split("")
          .map((x) => x + x)
          .join("")
      : m.slice(0, 6),
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Where a value sits on the color ramp (log-like, so light amounts get room). */
const pos = (v: number) => Math.log1p(v * 4);

/** Color of a value in inches: [r, g, b, a 0–255]. */
export function colorAt(
  v: number,
  s: { at: number; color: string }[],
): [number, number, number, number] {
  if (v < s[0].at) return [0, 0, 0, 0];
  let i = 0;
  while (i < s.length - 1 && v > s[i + 1].at) i++;
  const a = s[i];
  const b = s[Math.min(i + 1, s.length - 1)];
  const f =
    b === a ? 0 : Math.min(1, (pos(v) - pos(a.at)) / (pos(b.at) - pos(a.at)));
  const ca = hex(a.color);
  const cb = hex(b.color);
  // Light amounts are veils; an inch of rain (or a few of snow) and up is solid.
  const solid = s[2].at;
  const alpha = Math.round(
    255 * Math.min(0.95, 0.42 + 0.53 * (pos(v) / pos(solid))),
  );
  return [
    Math.round(ca[0] + (cb[0] - ca[0]) * f),
    Math.round(ca[1] + (cb[1] - ca[1]) * f),
    Math.round(ca[2] + (cb[2] - ca[2]) * f),
    alpha,
  ];
}

/** Code → RGBA, packed for an ImageData Uint32 view (little-endian ABGR). */
export function lut(table: CodeTable, s: { at: number; color: string }[]) {
  const vals = codeValues(table);
  const out = new Uint32Array(256);
  for (let c = 1; c < 256; c++) {
    const [r, g, b, a] = colorAt(vals[c], s);
    out[c] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return out;
}

/** "1.4″", "13″", "0.4″": inches as the map writes them. */
export function inches(v: number) {
  return `${v >= 10 ? v.toFixed(0) : v >= 0.95 ? v.toFixed(1) : v.toFixed(2).replace(/^0/, "")}″`;
}

/** A CSS gradient of the ramp for the legend bar. */
export function gradient(s: { at: number; color: string }[], max: number) {
  const span = pos(max);
  return `linear-gradient(90deg, ${s
    .filter((x) => x.at <= max)
    .map((x) => `${x.color} ${((pos(x.at) / span) * 100).toFixed(1)}%`)
    .join(", ")})`;
}

/** Where a tick sits on the legend bar (0–1). */
export const tickAt = (v: number, max: number) => pos(v) / pos(max);
