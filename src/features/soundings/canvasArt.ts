/**
 * The Skew-T and hodograph drawn on a canvas for the share cards, from the same path data as
 * the page's SVG charts (`geom.ts`), with a glow on the traces. Each fits a box: the caller
 * passes where and how wide; the chart keeps its own proportions.
 */
import type { Analysis, Parcel } from "@/lib/soundings/thermo";
import {
  barbPath,
  hodoGeom,
  PRESS,
  skewGrid,
  skewPaths,
  SK_H,
  SK_W,
  skX,
  skY,
} from "./geom";

type C = (k: string) => string;
type Ink = { line: string; muted: string; font: string };

/** The Skew-T's view box (as on the page): 30 left for pressures, 40 right for barbs. */
export const SKEW_BOX = { x: -30, y: -6, w: SK_W + 70, h: SK_H + 22 };

/** The static grid, drawn once into a canvas at `scale` (reused by every frame). */
export function skewGridLayer(scale: number, ink: Ink) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(SKEW_BOX.w * scale);
  cv.height = Math.round(SKEW_BOX.h * scale);
  const g = cv.getContext("2d")!;
  g.setTransform(scale, 0, 0, scale, -SKEW_BOX.x * scale, -SKEW_BOX.y * scale);
  const grid = skewGrid();
  g.save();
  g.beginPath();
  g.rect(0, 0, SK_W, SK_H);
  g.clip();
  g.lineWidth = 0.7;
  g.strokeStyle = "rgba(161,98,7,0.32)";
  for (const d of grid.dry) g.stroke(new Path2D(d));
  g.strokeStyle = "rgba(14,116,144,0.45)";
  g.setLineDash([3, 3]);
  for (const d of grid.moist) g.stroke(new Path2D(d));
  g.setLineDash([]);
  for (const l of grid.iso) {
    g.strokeStyle = l.t === 0 ? "rgba(96,165,250,0.6)" : ink.line;
    g.lineWidth = l.t === 0 ? 1 : 0.6;
    g.globalAlpha = l.t === 0 ? 1 : 0.7;
    g.stroke(new Path2D(l.d));
  }
  g.globalAlpha = 1;
  g.strokeStyle = ink.line;
  g.lineWidth = 0.7;
  for (const p of PRESS) {
    g.beginPath();
    g.moveTo(0, skY(p));
    g.lineTo(SK_W, skY(p));
    g.stroke();
  }
  g.restore();
  g.strokeStyle = ink.line;
  g.lineWidth = 1;
  g.strokeRect(0, 0, SK_W, SK_H);
  g.font = `600 9px ${ink.font}`;
  g.fillStyle = ink.muted;
  g.textAlign = "right";
  for (const p of PRESS) g.fillText(String(p), -4, skY(p) + 3);
  g.textAlign = "center";
  for (const t of [-30, -20, -10, 0, 10, 20, 30, 40])
    g.fillText(`${t}°`, skX(t, 1050), SK_H + 12);
  g.strokeStyle = ink.line;
  g.beginPath();
  g.moveTo(SK_W + 22, 0);
  g.lineTo(SK_W + 22, SK_H);
  g.stroke();
  return cv;
}

/** The sounding's lines, shading, marks and barbs over the grid, at (x, y) with `scale`. */
export function drawSkew(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  grid: HTMLCanvasElement,
  a: Analysis,
  parcel: Parcel,
  c: C,
  ink: Ink,
) {
  g.save();
  g.drawImage(grid, x, y);
  g.translate(x - SKEW_BOX.x * scale, y - SKEW_BOX.y * scale);
  g.scale(scale, scale);
  const d = skewPaths(a, parcel);
  g.save();
  g.beginPath();
  g.rect(0, 0, SK_W, SK_H);
  g.clip();
  const shade = (path: string, col: string) => {
    if (!path) return;
    const p = new Path2D(path);
    g.fillStyle = col;
    g.globalAlpha = 0.34;
    g.fill(p);
    g.globalAlpha = 0.65;
    g.strokeStyle = col;
    g.lineWidth = 0.6;
    g.stroke(p);
    g.globalAlpha = 1;
  };
  shade(d.cin, c("cin"));
  shade(d.cape, c("cape"));
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = c("parcel");
  g.lineWidth = 1.4;
  g.setLineDash([5, 3]);
  g.stroke(new Path2D(d.par));
  g.setLineDash([]);
  for (const [k, col] of [
    ["dew", c("dew")],
    ["temp", c("temp")],
  ] as const) {
    g.strokeStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 6;
    g.lineWidth = 2.4;
    g.stroke(new Path2D(k === "dew" ? d.dew : d.temp));
  }
  g.shadowBlur = 0;
  g.restore();
  g.font = `800 10px ${ink.font}`;
  g.lineJoin = "round";
  const tag = (
    txt: string,
    at: [number, number] | null,
    col: string,
    align: CanvasTextAlign,
  ) => {
    if (!at) return;
    g.textAlign = align;
    g.strokeStyle = "#0b0c14";
    g.lineWidth = 3;
    g.strokeText(txt, at[0], at[1]);
    g.fillStyle = col;
    g.fillText(txt, at[0], at[1]);
  };
  if (parcel.cape > 50)
    tag(`CAPE ${parcel.cape}`, d.capeAt, c("cape"), "center");
  if (parcel.cin < -5 && d.cinAt)
    tag(
      `CIN ${parcel.cin}`,
      [d.cinAt[0] - 6, d.cinAt[1] - 4],
      c("cin"),
      "right",
    );
  g.font = `700 9px ${ink.font}`;
  for (const [k, yy] of d.marks) {
    g.strokeStyle = c("parcel");
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(SK_W - 34, yy);
    g.lineTo(SK_W - 4, yy);
    g.stroke();
    g.fillStyle = c("parcel");
    g.textAlign = "right";
    g.fillText(k, SK_W - 36, yy + 3);
  }
  const bt = c("storm");
  g.lineWidth = 1.1;
  for (const b of d.barbs) {
    g.save();
    g.translate(SK_W + 22, b.y);
    g.rotate((b.dir * Math.PI) / 180);
    const p = new Path2D(barbPath(b.kt));
    g.strokeStyle = bt;
    g.fillStyle = bt;
    if (b.kt >= 2.5) g.fill(p);
    g.stroke(p);
    g.restore();
  }
  g.restore();
}

/** The hodograph in a size×size box at (x, y). */
export function drawHodo(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  a: Analysis,
  c: C,
  ink: Ink,
  ring?: number,
) {
  const S = 300;
  const k0 = size / S;
  const h = hodoGeom(a, S, ring);
  g.save();
  g.translate(x, y);
  g.scale(k0, k0);
  if (!h.enough) {
    g.font = `600 13px ${ink.font}`;
    g.fillStyle = ink.muted;
    g.textAlign = "center";
    g.fillText("Not enough wind data", S / 2, S / 2);
    g.restore();
    return;
  }
  const { C: cc, k } = h;
  g.strokeStyle = ink.line;
  g.lineWidth = 0.8;
  g.font = `600 8px ${ink.font}`;
  g.fillStyle = ink.muted;
  g.textAlign = "right";
  for (const r of h.rings) {
    g.beginPath();
    g.arc(cc, cc, r * k, 0, Math.PI * 2);
    g.stroke();
    g.fillText(String(r), cc - r * k * 0.707 - 2, cc + r * k * 0.707 + 9);
  }
  g.beginPath();
  g.moveTo(cc, 6);
  g.lineTo(cc, S - 6);
  g.moveTo(6, cc);
  g.lineTo(S - 6, cc);
  g.stroke();
  if (h.srh) {
    g.fillStyle = c("0-1");
    g.globalAlpha = 0.2;
    g.fill(new Path2D(h.srh));
    g.globalAlpha = 1;
  }
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = 2.8;
  for (const b of h.bands) {
    if (!b.d) continue;
    g.strokeStyle = c(b.key);
    g.shadowColor = c(b.key);
    g.shadowBlur = 8;
    g.stroke(new Path2D(b.d));
  }
  g.shadowBlur = 0;
  g.font = `700 9px ${ink.font}`;
  g.textAlign = "left";
  for (const p of h.ticks) {
    g.fillStyle = "#0b0c14";
    g.strokeStyle = "#fff";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(p.x, p.y, 3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#fff";
    g.fillText(p.label, p.x + 5, p.y - 4);
  }
  const st = c("storm");
  if (h.rm) {
    g.strokeStyle = st;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(h.rm.x, h.rm.y, 4.5, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = st;
    g.fillText("RM", h.rm.x + 7, h.rm.y + 3);
  }
  if (h.lm) {
    g.globalAlpha = 0.65;
    g.strokeStyle = st;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(h.lm.x, h.lm.y, 4, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = st;
    g.fillText("LM", h.lm.x + 7, h.lm.y + 3);
    g.globalAlpha = 1;
  }
  g.restore();
}
