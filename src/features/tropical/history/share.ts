/**
 * Share files for the History Globe (owner, 2026-11-24): a picture, a GIF or a video in the
 * share-card look of Radar and Model Runs. Every frame is drawn from the 3D scene itself at
 * full size (1080 px across the globe), never read off the screen, then laid into the card:
 * the title and link, the globe, a large year or date with its tag, a lit timeline and the
 * sources. Place names ride along when Places is on, and in Storm View the camera follows the
 * storm with its name, strength and the land glow it leaves. Loaded only when someone shares.
 */
import { tokens, type Tokens } from "@/features/share/card";
import {
  gifSink,
  mp4Sink,
  recordSink,
  type Format,
  type Sink,
} from "@/features/share/motion";
import type { TrackGlobe } from "./globe";

export type Clip = {
  globe: TrackGlobe;
  title: string;
  sub: string;
  /** The clock runs from `from` to `to` (epoch hours); new track burns bright for `fresh` hours. */
  from: number;
  to: number;
  fresh: number;
  /** Degrees the globe turns over the clip. */
  turn: number;
  /** The big line and its tag at a moment. */
  counter: (h: number) => [string, string];
  /** A storm named on the globe. */
  label?: { lat: number; lon: number; text: string; sub: string };
  foot: string;
};

const W = 1080;
const H = 1350;
const TOP = 118;
const G = 1080;
/** GIF: frames and their timing; video: frames a second and seconds of motion. */
const GIF_FRAMES = 48;
const GIF_MS = 90;
const FPS = 30;
const SECS = 8;
const HOLD_MS = 1800;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function framer(t: Tokens, clip: Clip) {
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")! as Ctx;
  const mono =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-mono")
      .trim() || "ui-monospace, monospace";
  return (globe: HTMLCanvasElement, h: number, frac: number) => {
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.letterSpacing = "0px";
    g.fillStyle = t.bg;
    g.fillRect(0, 0, W, H);
    // The page's glow, top left, and the globe stage behind the planet.
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 640);
    glow.addColorStop(0, t.accent);
    glow.addColorStop(1, "transparent");
    g.globalAlpha = 0.14;
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    const stage = g.createRadialGradient(
      W / 2,
      TOP + G * 0.45,
      0,
      W / 2,
      TOP + G * 0.45,
      G * 0.62,
    );
    stage.addColorStop(0, "rgba(40,60,110,0.22)");
    stage.addColorStop(1, "rgba(4,6,11,0)");
    g.fillStyle = stage;
    g.fillRect(0, TOP, W, G);

    // Title, sub line and the link.
    g.textAlign = "left";
    g.font = `800 38px ${t.disp}`;
    g.shadowColor = t.accent;
    g.shadowBlur = 18;
    g.fillStyle = t.text;
    g.fillText(clip.title, 40, 62, W - 380);
    g.shadowBlur = 0;
    g.font = `600 21px ${t.sans}`;
    g.fillStyle = t.muted;
    g.fillText(clip.sub, 40, 96, W - 80);
    g.textAlign = "right";
    g.font = `700 16px ${t.sans}`;
    g.letterSpacing = "3px";
    g.fillStyle = t.accent;
    g.fillText("WEATHER.SSWX.SPACE", W - 40, 60);
    g.letterSpacing = "0px";

    g.drawImage(globe, 0, TOP, G, G);
    // Place names (when Places is on) and Storm View's name and strength over the storm, at
    // the size they read on a phone.
    g.save();
    g.beginPath();
    g.rect(0, TOP, G, G);
    g.clip();
    clip.globe.paintOverlay(g, 0, TOP, G, G, G / 420);
    g.restore();

    // The storm's name on the globe, in the page's label style.
    const at = clip.label && clip.globe.project(clip.label.lat, clip.label.lon);
    if (clip.label && at) {
      const x = at.x * G;
      const y = TOP + at.y * G - 64;
      g.textAlign = "center";
      g.shadowColor = "rgba(0,0,0,0.9)";
      g.shadowBlur = 10;
      g.font = `800 30px ${t.sans}`;
      g.letterSpacing = "3px";
      g.fillStyle = t.text;
      g.fillText(clip.label.text.toUpperCase(), x, y);
      g.font = `700 22px ${mono}`;
      g.letterSpacing = "1px";
      g.fillStyle = t.accent;
      g.fillText(clip.label.sub, x, y + 28);
      g.shadowBlur = 0;
      g.letterSpacing = "0px";
    }

    // The counter: the year (or the storm's date) large, its tag, and a lit timeline.
    const [big, tag] = clip.counter(h);
    const y = TOP + G + 12;
    g.textAlign = "left";
    g.font = `700 58px ${mono}`;
    g.shadowColor = t.accent;
    g.shadowBlur = 22;
    g.fillStyle = t.accent;
    g.fillText(big, 40, y + 56, W - 400);
    g.shadowBlur = 0;
    g.font = `800 19px ${t.sans}`;
    g.letterSpacing = "3px";
    const tw = g.measureText(tag).width + 44;
    g.strokeStyle = t.accent;
    g.lineWidth = 2;
    g.shadowColor = t.accent;
    g.shadowBlur = 14;
    g.beginPath();
    g.roundRect(W - 40 - tw, y + 12, tw, 48, 24);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = t.text;
    g.fillText(tag, W - 40 - tw + 22, y + 43);
    g.letterSpacing = "0px";
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.beginPath();
    g.roundRect(40, y + 84, W - 80, 8, 4);
    g.fill();
    g.fillStyle = t.accent;
    g.shadowColor = t.accent;
    g.shadowBlur = 14;
    g.beginPath();
    g.roundRect(40, y + 84, Math.max(8, (W - 80) * frac), 8, 4);
    g.fill();
    g.shadowBlur = 0;
    g.textAlign = "center";
    g.font = `500 16px ${t.sans}`;
    g.fillStyle = t.muted;
    g.fillText(clip.foot, W / 2, H - 22, W - 80);
    return out;
  };
}

const png = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );

/** Make the picture, GIF or video of a clip; `progress` hears each frame. */
export async function makeGlobe(
  clip: Clip,
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  const draw = framer(await tokens(), clip);
  const g = clip.globe;
  g.captureStart(G);
  try {
    if (f === "image") {
      progress(0, 1);
      return await png(draw(g.captureFrame(clip.to, 0, 0), clip.to, 1));
    }
    const n = f === "gif" ? GIF_FRAMES : FPS * SECS;
    const sink: Sink | null =
      f === "gif"
        ? await gifSink(W, H, true)
        : ((await mp4Sink(W, H, FPS)) ?? recordSink(W, H));
    if (!sink) throw new Error("no encoder");
    for (let i = 0; i < n; i++) {
      progress(i, n);
      const k = i / (n - 1);
      // Ease in and out, so the clip settles on its last frame.
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const h = clip.from + (clip.to - clip.from) * e;
      const frame = draw(g.captureFrame(h, clip.fresh, clip.turn * e), h, e);
      const last = i === n - 1;
      await sink.add(frame, last ? HOLD_MS : f === "gif" ? GIF_MS : 1000 / FPS);
      // Let the page breathe between frames (the progress bar, the share sheet).
      await new Promise((ok) => setTimeout(ok, 0));
    }
    progress(n, n);
    return await sink.done();
  } finally {
    g.captureEnd();
  }
}
