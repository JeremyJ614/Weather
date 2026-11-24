/**
 * The History Globe's Places layer: country names from far out, then the biggest cities, then
 * states and provinces and smaller cities as you zoom in, only on the side facing you and never
 * overlapping. Drawn on a flat canvas over the globe (the same drawing makes the share files),
 * and only when the view changes.
 */
import type { Places } from "./data";

export type PlaceColors = { country: string; state: string; town: string };
/** Where a place lands on the target canvas (pixels) and how squarely it faces the camera. */
export type Project = (
  lat: number,
  lon: number,
) => { x: number; y: number; facing: number } | null;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

/** Which ranks show at a camera distance (1.28 close in to 6.5 far out). */
function want(dist: number) {
  return {
    country:
      dist > 4.6 ? 1 : dist > 3.6 ? 2 : dist > 2.6 ? 3 : dist > 1.9 ? 5 : 10,
    state: dist > 2.6 ? 0 : dist > 2.1 ? 2 : dist > 1.7 ? 4 : 10,
    town:
      dist > 3.6 ? 0 : dist > 2.7 ? 1 : dist > 2.0 ? 2 : dist > 1.55 ? 3 : 4,
  };
}

const widths = new Map<string, number>();
function measure(g: Ctx, font: string, text: string) {
  const k = `${font}|${text}`;
  let w = widths.get(k);
  if (w === undefined) {
    g.font = font;
    w = g.measureText(text).width;
    if (widths.size > 6000) widths.clear();
    widths.set(k, w);
  }
  return w;
}

/**
 * Draws the names for this view onto `g` (already cleared or holding the globe). `scale` is
 * pixels per CSS pixel; `dist` the camera's distance from the globe's center (radius 1).
 */
export function drawPlaces(
  g: Ctx,
  p: Places,
  project: Project,
  o: {
    dist: number;
    scale: number;
    w: number;
    h: number;
    colors: PlaceColors;
    sans: string;
    /** Screen boxes already taken (storm labels), kept clear. */
    taken?: [number, number, number, number][];
  },
) {
  const lim = want(o.dist);
  const k = o.scale;
  const boxes: [number, number, number, number][] = [...(o.taken ?? [])];
  const free = (b: [number, number, number, number]) =>
    !boxes.some(
      (x) => b[0] < x[2] && b[2] > x[0] && b[1] < x[3] && b[3] > x[1],
    );
  const fonts = {
    country: `700 ${11 * k}px ${o.sans}`,
    state: `600 ${9.5 * k}px ${o.sans}`,
    town: `500 ${10.5 * k}px ${o.sans}`,
  };
  type Item = {
    kind: "country" | "state" | "town";
    text: string;
    x: number;
    y: number;
    a: number;
  };
  const out: Item[] = [];
  const MAX = 90;
  const tryAdd = (
    kind: Item["kind"],
    name: string,
    lat: number,
    lon: number,
  ) => {
    if (out.length >= MAX) return;
    const at = project(lat, lon);
    if (!at || at.facing < 0.3) return;
    if (at.x < -40 || at.y < -20 || at.x > o.w + 40 || at.y > o.h + 20) return;
    const text = kind === "town" ? name : name.toUpperCase();
    g.letterSpacing =
      kind === "town" ? "0px" : `${(kind === "country" ? 2.2 : 1.4) * k}px`;
    const w = measure(g, fonts[kind], text);
    const fs = (kind === "country" ? 11 : kind === "state" ? 9.5 : 10.5) * k;
    const pad = 3 * k;
    const b: [number, number, number, number] =
      kind === "town"
        ? [
            at.x - 4 * k - pad,
            at.y - fs * 0.7 - pad,
            at.x + 6 * k + w + pad,
            at.y + fs * 0.5 + pad,
          ]
        : [
            at.x - w / 2 - pad,
            at.y - fs * 0.6 - pad,
            at.x + w / 2 + pad,
            at.y + fs * 0.6 + pad,
          ];
    if (!free(b)) return;
    boxes.push(b);
    out.push({
      kind,
      text,
      x: at.x,
      y: at.y,
      a: Math.min(1, (at.facing - 0.3) * 3.5),
    });
  };
  // Priority: countries, the biggest cities, states, then smaller cities.
  for (const c of p.c)
    if (c[3] <= lim.country) tryAdd("country", c[0], c[1], c[2]);
  for (const t of p.t)
    if (t[3] === 1 && t[3] <= lim.town) tryAdd("town", t[0], t[1], t[2]);
  for (const s of p.s) if (s[3] <= lim.state) tryAdd("state", s[0], s[1], s[2]);
  for (const t of p.t)
    if (t[3] > 1 && t[3] <= lim.town) tryAdd("town", t[0], t[1], t[2]);

  g.save();
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.95)";
  g.shadowBlur = 6 * k;
  for (const it of out) {
    g.globalAlpha = it.a * (it.kind === "town" ? 0.95 : 0.8);
    g.font = fonts[it.kind];
    g.letterSpacing =
      it.kind === "town"
        ? "0px"
        : `${(it.kind === "country" ? 2.2 : 1.4) * k}px`;
    g.fillStyle = o.colors[it.kind];
    if (it.kind === "town") {
      g.textAlign = "left";
      g.beginPath();
      g.arc(it.x, it.y, 2.1 * k, 0, Math.PI * 2);
      g.fill();
      g.fillText(it.text, it.x + 5.5 * k, it.y);
    } else {
      g.textAlign = "center";
      g.fillText(it.text, it.x, it.y);
    }
  }
  g.restore();
  g.letterSpacing = "0px";
}
