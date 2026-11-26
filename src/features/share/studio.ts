/**
 * Shared pieces for the hand-drawn share cards (Fall color, Daylight, Soundings, River gauges;
 * owner's list #41): the theme's ground with two soft glows and a faint grid, the masthead
 * (page on the left, weather.sswx.space on the right), a glowing headline, a place line, and
 * one encoder loop for picture, GIF and video. Everything is drawn on the phone and loaded only
 * when someone taps Share.
 */
import type { Tokens } from "./card";
import { gifSink, mp4Sink, recordSink, type Format, type Sink } from "./motion";

export const SW = 1080;
export const SH = 1350;
export type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

export function canvas(w = SW, h = SH) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")! as Ctx;
  return { c, g };
}

export function mono() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim() || "ui-monospace, monospace"
  );
}

/** Ground, two glows (accent top left, `second` bottom right) and a faint 54 px grid. */
export function backdrop(g: Ctx, t: Tokens, second = t.accent, w = SW, h = SH) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  g.fillStyle = t.bg;
  g.fillRect(0, 0, w, h);
  const glow = (x: number, y: number, r: number, c: string, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, c);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  };
  glow(0, 0, w * 0.72, t.accent, 0.16);
  glow(w, h, w * 0.8, second, 0.12);
  g.globalAlpha = 0.045;
  g.strokeStyle = t.text;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 54; x < w; x += 54) {
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
  }
  for (let y = 54; y < h; y += 54) {
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
  }
  g.stroke();
  g.globalAlpha = 1;
}

/** "SSWX WEATHER CENTER · PAGE" left, the site right, at y = 62. */
export function masthead(g: Ctx, t: Tokens, page: string, w = SW) {
  g.font = `700 15px ${t.sans}`;
  g.letterSpacing = "5px";
  g.fillStyle = t.accent;
  g.textAlign = "left";
  g.fillText(`SSWX WEATHER CENTER · ${page}`.toUpperCase(), 48, 62, w - 380);
  g.textAlign = "right";
  g.fillText("WEATHER.SSWX.SPACE", w - 48, 62);
  g.textAlign = "left";
  g.letterSpacing = "0px";
}

/** A pin and the place in caps, glowing, at (x, y); returns its width. */
export function place(
  g: Ctx,
  t: Tokens,
  name: string,
  x: number,
  y: number,
  size = 22,
  max = SW - 96,
) {
  const r = size * 0.34;
  g.save();
  g.fillStyle = t.accent;
  g.shadowColor = t.accent;
  g.shadowBlur = 12;
  g.beginPath();
  g.arc(x + r, y - size * 0.55, r, Math.PI, 0);
  g.lineTo(x + r, y - size * 0.55 + r * 2.1);
  g.closePath();
  g.fill();
  g.fillStyle = t.bg;
  g.beginPath();
  g.arc(x + r, y - size * 0.55, r * 0.42, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.font = `800 ${size}px ${t.sans}`;
  g.letterSpacing = "3px";
  g.fillStyle = t.text;
  g.textAlign = "left";
  const label = name.toUpperCase();
  g.fillText(label, x + r * 2 + 12, y, max - r * 2 - 12);
  const w = Math.min(max, g.measureText(label).width + r * 2 + 12);
  g.letterSpacing = "0px";
  return w;
}

/** The big line: `lit` in the glowing accent, `rest` after it in text color. */
export function headline(
  g: Ctx,
  t: Tokens,
  lit: string,
  rest: string,
  y: number,
  size = 76,
  w = SW,
) {
  g.font = `800 ${size}px ${t.disp}`;
  g.textAlign = "left";
  g.shadowColor = t.accent;
  g.shadowBlur = 26;
  g.fillStyle = t.accent;
  g.fillText(lit, 48, y, w - 96);
  const lw = Math.min(w - 96, g.measureText(lit).width);
  g.shadowBlur = 0;
  if (rest) {
    g.fillStyle = t.text;
    g.fillText(` ${rest}`, 48 + lw, y, Math.max(80, w - 96 - lw));
  }
}

/** A lit rounded panel (the frame around a chart or a stat). */
export function panel(
  g: Ctx,
  t: Tokens,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 26,
  lit = 0.35,
) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = "rgba(255,255,255,0.035)";
  g.fill();
  const edge = g.createLinearGradient(x, y, x + w, y + h);
  edge.addColorStop(0, t.accent);
  edge.addColorStop(0.5, "rgba(255,255,255,0.10)");
  edge.addColorStop(1, t.accent);
  g.strokeStyle = edge;
  g.globalAlpha = lit;
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
}

/** A small label over a big number, left-aligned at x. */
export function stat(
  g: Ctx,
  t: Tokens,
  k: string,
  v: string,
  x: number,
  y: number,
  o: { color?: string; size?: number; max?: number; sub?: string } = {},
) {
  g.textAlign = "left";
  g.font = `700 13px ${t.sans}`;
  g.letterSpacing = "3px";
  g.fillStyle = t.muted;
  g.fillText(k.toUpperCase(), x, y, o.max);
  g.letterSpacing = "0px";
  g.font = `800 ${o.size ?? 44}px ${t.disp}`;
  g.fillStyle = o.color ?? t.text;
  if (o.color) {
    g.shadowColor = o.color;
    g.shadowBlur = 16;
  }
  g.fillText(v, x, y + (o.size ?? 44) + 8, o.max);
  g.shadowBlur = 0;
  if (o.sub) {
    g.font = `600 15px ${t.sans}`;
    g.fillStyle = t.muted;
    g.fillText(o.sub, x, y + (o.size ?? 44) + 34, o.max);
  }
}

/** The source line, centered at the foot. */
export function foot(g: Ctx, t: Tokens, text: string, w = SW, h = SH) {
  g.font = `500 15px ${t.sans}`;
  g.fillStyle = t.muted;
  g.textAlign = "center";
  g.fillText(text, w / 2, h - 24, w - 80);
  g.textAlign = "left";
}

export const png = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );

/**
 * Picture, GIF or video from a frame function. `frame(i, total)` draws frame i (0-based) and
 * returns its canvas; the picture is the last frame. GIFs share one palette from three sample
 * frames and store only changed pixels; videos use WebCodecs, else a real-time recording.
 */
export async function encode(
  f: Format,
  frame: (i: number, total: number) => Promise<HTMLCanvasElement>,
  progress: (done: number, total: number) => void,
  o: {
    w?: number;
    h?: number;
    gifFrames?: number;
    gifMs?: number;
    fps?: number;
    secs?: number;
    holdMs?: number;
  } = {},
): Promise<Blob> {
  const w = o.w ?? SW;
  const h = o.h ?? SH;
  if (f === "image") {
    progress(0, 1);
    return png(await frame(0, 1));
  }
  const gifFrames = o.gifFrames ?? 120;
  const fps = o.fps ?? 30;
  const total = f === "gif" ? gifFrames : Math.round(fps * (o.secs ?? 8));
  const hold = o.holdMs ?? 2200;
  let sink: Sink | null;
  if (f === "gif") {
    const sample: ImageData[] = [];
    for (const i of [total - 1, Math.floor(total / 2), 0])
      sample.push(
        (await frame(i, total)).getContext("2d")!.getImageData(0, 0, w, h),
      );
    sink = await gifSink(w, h, true, sample);
  } else sink = (await mp4Sink(w, h, fps)) ?? recordSink(w, h);
  if (!sink) throw new Error("no encoder");
  for (let i = 0; i < total; i++) {
    progress(i, total);
    const fr = await frame(i, total);
    await sink.add(
      fr,
      i === total - 1 ? hold : f === "gif" ? (o.gifMs ?? 50) : 1000 / fps,
    );
    // Let the page breathe between frames (the progress bar, taps).
    await new Promise((ok) => setTimeout(ok, 0));
  }
  progress(total, total);
  return sink.done();
}

/** Ease in and out. */
export const ease = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
