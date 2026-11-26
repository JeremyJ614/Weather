/**
 * Share files for the 7-day rain and snow maps (owner's Fix it List #39): a 1080×1350 card in
 * the app's look, headlined "LAST 7 DAYS OF RAIN" and the dates, the map framed on whatever
 * the viewer has pulled up, totals counting up at the places that got the most, the reports
 * as they came in, the time, the color scale and the sources. The picture is the week's
 * total; the GIF and video play the week piling up. Every frame is drawn here from the map's
 * own data, never read off the screen.
 */
import { tokens } from "@/features/share/card";
import {
  gifSink,
  mp4Sink,
  recordSink,
  type Format,
  type Sink,
} from "@/features/share/motion";
import { inches, tickAt, TICKS } from "./codes";
import type { Meta } from "./SevenDayMap";

const W = 1080;
const H = 1350;
const MAP_Y = 262;
const MAP_H = 900;
const CW = 975;
const CH = 610;
// 20 frames a second (owner, Fix it List #40: smooth, not choppy).
const GIF_FRAMES = 120;
const GIF_MS = 50;
const FPS = 30;
const SECS = 8;
const HOLD_MS = 2200;

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };
type Box = { x: number; y: number; w: number; h: number };

export type SevenDayClip = {
  meta: Meta;
  urls: string[];
  /** Full-size step pictures (a zoomed-in share needs them; made on first use). */
  sharp: () => Promise<string[]>;
  ramp: { at: number; color: string }[];
  marks: { flood: string; snow: string; max: string };
  /** What's on the map now, in map units (the whole map until the viewer zooms). */
  view: { x: number; y: number; w: number };
};

let base: Promise<{ nation: string; states: { d: string }[] }> | null = null;
const loadBase = () =>
  (base ??= fetch("/api/maps/base").then((r) => {
    if (!r.ok) throw new Error("base map");
    return r.json();
  }));

/**
 * What the viewer has on the map (all of the lower 48 until they zoom), shaped to the card's
 * map area (owner, Fix it List #40: "focus on whatever I have pulled up on the map").
 */
function frame(c: SevenDayClip): Box {
  const aspect = W / MAP_H;
  const v = c.view;
  let b: Box = { x: v.x, y: v.y, w: v.w, h: (v.w * CH) / CW };
  // Grow the short side so the box matches the card.
  if (b.w / b.h > aspect) {
    const h = b.w / aspect;
    b = { ...b, y: b.y - (h - b.h) / 2, h };
  } else {
    const w = b.h * aspect;
    b = { ...b, x: b.x - (w - b.w) / 2, w };
  }
  return b;
}

const fmtWhen = (iso: string) =>
  new Date(iso)
    .toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      timeZoneName: "short",
    })
    .toUpperCase();

/** The headline: "LAST 7 DAYS / OF RAIN", then the dates (owner: no single place's total). */
function headline(m: Meta): [string, string, string] {
  const noun = m.kind === "rain" ? "RAIN" : "SNOW";
  const d = (iso: string) =>
    new Date(iso)
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toUpperCase();
  return ["LAST 7 DAYS", `OF ${noun}`, `${d(m.start)} TO ${d(m.end)}`];
}

async function bitmap(url: string) {
  return createImageBitmap(await (await fetch(url)).blob());
}

/** Make the picture, GIF or video; `progress` hears each frame. */
export async function makeSevenDay(
  c: SevenDayClip,
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  const t = await tokens();
  const b = await loadBase();
  const nation = new Path2D(b.nation);
  const states = new Path2D(b.states.map((x: { d: string }) => x.d).join(""));
  const css = getComputedStyle(document.documentElement);
  const land = css.getPropertyValue("--surface2").trim() || "#151826";
  const mono =
    css.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace";
  const m = c.meta;
  const n = m.steps.length;
  const box = frame(c);
  const k = W / box.w;
  const [big, mid, small] = headline(m);
  const tickMax = TICKS[m.kind].at(-1)!;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")! as Ctx;

  // Places to label in the frame (the biggest weekly totals), in card pixels. A label near
  // the card's edge is nudged inside it (its dot stays put), so no name is cut off.
  const fs = 30;
  const valueFont = `800 ${fs}px ${t.disp}`;
  const nameFont = `700 14px ${t.sans}`;
  const picks: {
    city: Meta["cities"][number];
    x: number;
    y: number;
    cx: number;
  }[] = [];
  {
    const boxes: [number, number, number, number][] = [];
    const least = m.kind === "rain" ? 0.5 : 2;
    for (const city of m.cities) {
      if (picks.length >= 10) break;
      const v = city[5].at(-1) ?? 0;
      if (v < least) break;
      const x = (city[2] - box.x) * k;
      const y = MAP_Y + (city[3] - box.y) * k;
      if (x < 12 || x > W - 12 || y < MAP_Y + 40 || y > MAP_Y + MAP_H - 30)
        continue;
      g.font = valueFont;
      const vw = g.measureText(inches(v)).width;
      g.font = nameFont;
      g.letterSpacing = "2.5px";
      const nw = g.measureText(city[0].toUpperCase()).width;
      g.letterSpacing = "0px";
      const w = Math.max(vw, nw) + 24;
      const cx = Math.min(W - 14 - w / 2, Math.max(14 + w / 2, x));
      const r: [number, number, number, number] = [
        cx - w / 2,
        y - fs * 1.6,
        cx + w / 2,
        y + fs * 1.0,
      ];
      if (
        boxes.some(
          (o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1],
        )
      )
        continue;
      boxes.push(r);
      picks.push({ city, x, y, cx });
    }
  }

  const draw = (
    a: ImageBitmap,
    bImg: ImageBitmap | null,
    mix: number,
    s: number,
  ) => {
    // s: the step as a fraction (for the clock, the counts and the reports).
    const step = Math.min(n - 1, Math.floor(s));
    const frac = s - step;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.letterSpacing = "0px";
    g.fillStyle = t.bg;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, 700);
    glow.addColorStop(0, t.accent);
    glow.addColorStop(1, "transparent");
    g.globalAlpha = 0.12;
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;

    // The map, framed.
    g.save();
    g.beginPath();
    g.rect(0, MAP_Y, W, MAP_H);
    g.clip();
    g.setTransform(k, 0, 0, k, -box.x * k, MAP_Y - box.y * k);
    g.fillStyle = land;
    g.fill(nation);
    g.fillStyle = "rgba(0,0,0,0.18)";
    g.fill(nation);
    g.save();
    g.clip(nation);
    g.imageSmoothingQuality = "high";
    g.drawImage(a, 0, 0, CW, CH);
    if (bImg && mix > 0) {
      g.globalAlpha = mix;
      g.drawImage(bImg, 0, 0, CW, CH);
      g.globalAlpha = 1;
    }
    g.restore();
    g.lineJoin = "round";
    g.strokeStyle = "rgba(255,255,255,0.24)";
    g.lineWidth = 1.3 / k;
    g.stroke(states);
    g.strokeStyle = t.accent;
    g.globalAlpha = 0.22;
    g.lineWidth = 9 / k;
    g.stroke(nation);
    g.globalAlpha = 0.75;
    g.lineWidth = 1.8 / k;
    g.stroke(nation);
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Reports so far.
    const hrs =
      (new Date(m.steps[step]).getTime() - new Date(m.start).getTime()) /
        3600_000 +
      frac * (m.kind === "rain" ? 6 : 24);
    const rc = m.kind === "rain" ? c.marks.flood : c.marks.snow;
    g.fillStyle = rc;
    g.shadowColor = rc;
    g.shadowBlur = 8;
    for (const r of m.reports) {
      if (r.t > hrs) continue;
      const x = (r.x - box.x) * k;
      const y = MAP_Y + (r.y - box.y) * k;
      if (x < -5 || x > W + 5 || y < MAP_Y - 5 || y > MAP_Y + MAP_H + 5)
        continue;
      g.globalAlpha = hrs - r.t < 12 ? 1 : 0.6;
      g.beginPath();
      g.arc(x, y, Math.max(3, Math.min(7, 0.9 * k)), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    // The biggest total, ringed, once the week is in.
    if (s >= n - 1.001 && m.max.in > 0) {
      const x = (m.max.x - box.x) * k;
      const y = MAP_Y + (m.max.y - box.y) * k;
      g.strokeStyle = c.marks.max;
      g.shadowColor = c.marks.max;
      g.shadowBlur = 16;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 18, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
    }
    // Totals counting up at the places that got the most.
    g.textAlign = "center";
    for (const { city, x, y, cx } of picks) {
      const ser = city[5];
      const v =
        (ser[step] ?? 0) +
        ((ser[Math.min(n - 1, step + 1)] ?? 0) - (ser[step] ?? 0)) * frac;
      // A place shows once some has fallen there (no ".00″" labels).
      if (v < (m.kind === "rain" ? 0.05 : 0.1)) continue;
      g.fillStyle = "#fff";
      g.strokeStyle = "rgba(0,0,0,0.75)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.lineJoin = "round";
      g.font = valueFont;
      g.lineWidth = 7;
      g.strokeStyle = "rgba(4,6,11,0.85)";
      g.strokeText(inches(v), cx, y - 14);
      g.shadowColor = "rgba(255,255,255,0.35)";
      g.shadowBlur = 10;
      g.fillStyle = "#fff";
      g.fillText(inches(v), cx, y - 14);
      g.shadowBlur = 0;
      g.font = nameFont;
      g.letterSpacing = "2.5px";
      g.lineWidth = 5;
      g.strokeText(city[0].toUpperCase(), cx, y + 26);
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillText(city[0].toUpperCase(), cx, y + 26);
      g.letterSpacing = "0px";
    }
    g.restore();
    // A fade where the map meets the header and the legend.
    for (const [y0, y1] of [
      [MAP_Y, MAP_Y + 60],
      [MAP_Y + MAP_H, MAP_Y + MAP_H - 60],
    ]) {
      const fade = g.createLinearGradient(0, y0, 0, y1);
      fade.addColorStop(0, t.bg);
      fade.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = fade;
      g.fillRect(0, Math.min(y0, y1), W, 60);
    }

    // Headline.
    g.textAlign = "left";
    g.font = `700 15px ${t.sans}`;
    g.letterSpacing = "5px";
    g.fillStyle = t.accent;
    g.fillText(`SSWX WEATHER CENTER · LAST 7 DAYS`, 48, 62);
    g.textAlign = "right";
    g.fillText("WEATHER.SSWX.SPACE", W - 48, 62);
    g.textAlign = "left";
    g.letterSpacing = "0px";
    g.font = `800 76px ${t.disp}`;
    g.shadowColor = t.accent;
    g.shadowBlur = 26;
    g.fillStyle = t.accent;
    g.fillText(big, 48, 146, W - 96);
    const bw = Math.min(W - 96, g.measureText(big).width);
    g.shadowBlur = 0;
    g.fillStyle = t.text;
    g.fillText(` ${mid}`, 48 + bw, 146, Math.max(80, W - 96 - bw));
    g.font = `700 26px ${t.sans}`;
    g.fillStyle = t.text;
    g.fillText(small, 48, 190, W - 96);
    // The clock and a lit progress line.
    g.font = `700 17px ${mono}`;
    g.letterSpacing = "2px";
    g.fillStyle = t.muted;
    g.fillText(
      `${m.kind === "rain" ? "RAINFALL" : "SNOWFALL"} SO FAR · ${fmtWhen(m.steps[step])}`,
      48,
      232,
      W - 96,
    );
    g.letterSpacing = "0px";
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(48, 246, W - 96, 4);
    g.fillStyle = t.accent;
    g.shadowColor = t.accent;
    g.shadowBlur = 10;
    g.fillRect(48, 246, Math.max(6, (W - 96) * Math.min(1, s / (n - 1))), 4);
    g.shadowBlur = 0;

    // The color scale.
    const ly = MAP_Y + MAP_H + 22;
    g.font = `700 14px ${t.sans}`;
    g.letterSpacing = "3px";
    g.fillStyle = t.muted;
    g.fillText(
      `TOTAL ${m.kind === "rain" ? "RAIN" : "SNOW"} (INCHES)`,
      48,
      ly + 14,
    );
    g.letterSpacing = "0px";
    const bar = g.createLinearGradient(48, 0, W - 48, 0);
    for (const s0 of c.ramp)
      if (s0.at <= tickMax) bar.addColorStop(tickAt(s0.at, tickMax), s0.color);
    g.fillStyle = bar;
    g.beginPath();
    g.roundRect(48, ly + 26, W - 96, 12, 6);
    g.fill();
    g.font = `600 15px ${mono}`;
    g.fillStyle = t.muted;
    g.textAlign = "center";
    for (const v of TICKS[m.kind])
      g.fillText(String(v), 48 + (W - 96) * tickAt(v, tickMax), ly + 62);
    g.font = `500 15px ${t.sans}`;
    g.fillText(
      `${m.source} · reports: National Weather Service via the Iowa Environmental Mesonet`,
      W / 2,
      H - 24,
      W - 80,
    );
    return out;
  };

  const png = (cv: HTMLCanvasElement) =>
    new Promise<Blob>((ok, no) =>
      cv.toBlob((x) => (x ? ok(x) : no(new Error("empty"))), "image/png"),
    );

  // Zoomed in, the half-size playback steps would look soft: use full-size ones.
  const urls = k > 1.4 && f !== "image" ? await c.sharp() : c.urls;
  if (f === "image") {
    progress(0, 1);
    const last = await bitmap(urls[n - 1]);
    const blob = await png(draw(last, null, 0, n - 1));
    last.close();
    return blob;
  }
  const total = f === "gif" ? GIF_FRAMES : FPS * SECS;
  const cache = new Map<number, ImageBitmap>();
  const get = async (i: number) => {
    let bmp = cache.get(i);
    if (!bmp) {
      bmp = await bitmap(urls[i]);
      cache.set(i, bmp);
      // Keep two: the step and the one after it.
      for (const [j, old] of cache)
        if (j < i - 1) {
          old.close();
          cache.delete(j);
        }
    }
    return bmp;
  };
  const at = async (i: number) => {
    const s = (i / (total - 1)) * (n - 1);
    const step = Math.min(n - 1, Math.floor(s));
    const a = await get(step);
    const next = step + 1 < n ? await get(step + 1) : null;
    return draw(a, next, s - step, s);
  };
  try {
    let sink: Sink | null;
    if (f === "gif") {
      // Full 1080p, one palette from the first, middle and last frames, only changed pixels.
      const sample: ImageData[] = [];
      for (const i of [total - 1, Math.floor(total / 2), 0])
        sample.push((await at(i)).getContext("2d")!.getImageData(0, 0, W, H));
      sink = await gifSink(W, H, true, sample);
    } else sink = (await mp4Sink(W, H, FPS)) ?? recordSink(W, H);
    if (!sink) throw new Error("no encoder");
    for (let i = 0; i < total; i++) {
      progress(i, total);
      const fr = await at(i);
      await sink.add(
        fr,
        i === total - 1 ? HOLD_MS : f === "gif" ? GIF_MS : 1000 / FPS,
      );
      await new Promise((ok) => setTimeout(ok, 0));
    }
    progress(total, total);
    return await sink.done();
  } finally {
    for (const bmp of cache.values()) bmp.close();
  }
}
