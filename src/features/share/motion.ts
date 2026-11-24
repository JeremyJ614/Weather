import { grab } from "@/features/map/snapshot";
import { Card, tokens } from "./card";

/**
 * Radar and model loops as a styled picture, GIF or video (owner, 2026-11-13). Each frame is
 * put on the live map, read back, and drawn into the share-card look: the header, the map in
 * its lit frame with a LIVE or FORECAST badge, the frame's time and a lit timeline, the key.
 * Frames are captured and encoded one at a time, so a long loop never sits in memory whole.
 * Everything runs on the phone: GIFs with gifenc, MP4 with the browser's own video encoder
 * (WebCodecs), or a real-time recording where that's missing.
 */
type MapLike = Parameters<typeof grab>[0];

export type Legend =
  | { swatches: [string, string][] }
  | { scale: string[]; ticks: (string | number)[]; name: string };

export type Reel = {
  title: string;
  sub: string;
  badge: "LIVE" | "FORECAST";
  legend: Legend | null;
  foot: string;
  /** Frames in the loop, the one on screen, and how long each shows (ms). */
  count: number;
  at: number;
  delay: number;
  map: MapLike;
  /** Put frame `k` on the map; false when it can't be had. */
  show: (k: number) => Promise<boolean>;
  /** The frame's time and its short tag ("F006", "20 MIN AGO"). */
  label: (k: number) => [string, string];
  /** Put the map back as the viewer left it. */
  restore: () => void;
  /**
   * Models: frame `k` drawn straight from its full-size picture, sharper than anything read
   * off the screen. With it, the GIF and video are map-first (Fix list #34).
   */
  art?: (k: number) => Promise<HTMLCanvasElement | null>;
  /** The model and the field, for the map-first GIF and video's top line. */
  brand?: [string, string];
};

export type Format = "image" | "gif" | "video";

const FW = 1080;
const FH = 1350;
const even = (n: number) => Math.round(n / 2) * 2;

/** At most `max` frames, evenly spaced and always ending on the last. */
export function pickFrames(n: number, max: number) {
  const step = Math.max(1, Math.ceil(n / max));
  const out: number[] = [];
  for (let k = (n - 1) % step; k < n; k += step) out.push(k);
  return out;
}

/** Resolves once the map has drawn what was just put on it (or after 8 s). */
function settle(m: MapLike) {
  return new Promise<void>((ok) => {
    const t = setTimeout(ok, 8000);
    (m as unknown as { once: (e: string, f: () => void) => void }).once(
      "idle",
      () => {
        clearTimeout(t);
        ok();
      },
    );
    m.triggerRepaint();
  });
}

/** Draws one frame of the reel into the 1080×1350 card. */
async function framer(r: Reel) {
  const c = new Card(await tokens());
  const out = document.createElement("canvas");
  const below =
    150 + (r.legend ? ("scale" in r.legend ? 112 : 34 * 2 + 14) : 0) + 70;
  return (shot: HTMLCanvasElement, k: number, idx: number, total: number) => {
    const g = c.g;
    const a = c.t.accent;
    c.restart();
    c.header(r.title, r.sub);
    const box = c.frame(shot, FH - c.y - below, 0.2);

    // The badge on the map.
    c.font(800, 15);
    c.track(3);
    const bw = g.measureText(r.badge).width + 54;
    const bx = box.x + 18;
    const by = box.y + 18;
    g.fillStyle = "rgba(5,8,18,0.8)";
    c.rr(bx, by, bw, 34, 17);
    g.fill();
    g.strokeStyle = a;
    g.lineWidth = 1.5;
    g.stroke();
    const dot = r.badge === "LIVE" ? "#ef4444" : a;
    g.fillStyle = dot;
    c.glow(12, dot);
    g.beginPath();
    g.arc(bx + 19, by + 17, 5, 0, Math.PI * 2);
    g.fill();
    c.reset();
    c.font(800, 15);
    c.track(3);
    g.fillStyle = c.t.text;
    g.fillText(r.badge, bx + 33, by + 23);
    c.reset();

    // The frame's time, its tag and the lit timeline.
    const [time, tag] = r.label(k);
    const y0 = c.y - 6;
    c.font(800, 40, true);
    c.glow(18);
    g.fillStyle = c.t.text;
    g.fillText(time, c.x, y0 + 40, c.w - 260);
    c.reset();
    c.font(800, 17);
    c.track(2);
    const tw = g.measureText(tag).width + 38;
    const tx = c.x + c.w - tw;
    g.strokeStyle = a;
    g.lineWidth = 1.5;
    c.glow(14);
    c.rr(tx, y0 + 8, tw, 40, 20);
    g.stroke();
    c.reset();
    c.font(800, 17);
    c.track(2);
    g.fillStyle = a;
    g.fillText(tag, tx + 19, y0 + 34);
    c.reset();
    const ty = y0 + 70;
    const gap = total > 30 ? 3 : 6;
    const sw = (c.w - gap * (total - 1)) / total;
    for (let i = 0; i < total; i++) {
      g.fillStyle = i <= idx ? a : "rgba(255,255,255,0.08)";
      g.globalAlpha = i < idx ? 0.55 : 1;
      if (i === idx) c.glow(16);
      c.rr(c.x + i * (sw + gap), ty, sw, 10, 4);
      g.fill();
      c.reset();
    }
    c.font(600, 15);
    c.track(2);
    g.fillStyle = c.t.muted;
    g.fillText(`FRAME ${idx + 1} OF ${total}`, c.x, ty + 40);
    c.reset();
    c.y = ty + 66;

    if (r.legend) {
      if ("scale" in r.legend)
        c.scale(r.legend.scale, r.legend.ticks, r.legend.name);
      else c.legend(r.legend.swatches);
    }
    c.y = FH - 56;
    c.text(r.foot, {
      size: 17,
      weight: 500,
      color: c.t.muted,
      align: "center",
      max: 1,
    });
    return c.paint(FH, out);
  };
}

export type Sink = {
  add: (frame: HTMLCanvasElement, ms: number) => Promise<void>;
  done: () => Promise<Blob>;
};

/** A GIF `w`×`h`, each frame with its own 256-color palette (`fine`: a finer color search). */
export async function gifSink(
  w: number,
  h: number,
  fine = false,
): Promise<Sink> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sg = small.getContext("2d", { willReadFrequently: true })!;
  sg.imageSmoothingQuality = "high";
  const format = fine ? "rgb565" : "rgb444";
  return {
    add: async (f, ms) => {
      sg.drawImage(f, 0, 0, w, h);
      const { data } = sg.getImageData(0, 0, w, h);
      const palette = quantize(data, 256, { format });
      gif.writeFrame(applyPalette(data, palette, format), w, h, {
        palette,
        delay: ms,
      });
    },
    done: async () => {
      gif.finish();
      return new Blob([gif.bytes().slice()], { type: "image/gif" });
    },
  };
}

/** MP4 from the browser's H.264 encoder, `fps` frames a second, the loop's frames held. */
export async function mp4Sink(
  FW: number,
  FH: number,
  fps = 10,
): Promise<Sink | null> {
  const step = 1_000_000 / fps;
  if (typeof VideoEncoder === "undefined") return null;
  let config: VideoEncoderConfig | null = null;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.420028"]) {
    const c = {
      codec,
      width: FW,
      height: FH,
      bitrate: 8_000_000,
      framerate: fps,
    };
    if (
      (await VideoEncoder.isConfigSupported(c).catch(() => null))?.supported
    ) {
      config = c;
      break;
    }
  }
  if (!config) return null;
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: FW, height: FH },
    fastStart: "in-memory",
  });
  let failed: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failed = e),
  });
  enc.configure(config);
  let n = 0;
  return {
    add: async (f, ms) => {
      for (let r = Math.max(1, Math.round((ms * 1000) / step)); r > 0; r--) {
        const vf = new VideoFrame(f, {
          timestamp: Math.round(n * step),
          duration: Math.round(step),
        });
        enc.encode(vf, { keyFrame: n % (fps * 2) === 0 });
        vf.close();
        n++;
        if (enc.encodeQueueSize > 6)
          await new Promise((ok) =>
            enc.addEventListener("dequeue", ok, { once: true }),
          );
      }
      if (failed) throw failed;
    },
    done: async () => {
      await enc.flush();
      if (failed) throw failed;
      muxer.finalize();
      return new Blob([target.buffer], { type: "video/mp4" });
    },
  };
}

/** Where WebCodecs is missing: record the frames in real time, paused while each is made. */
export function recordSink(FW: number, FH: number): Sink | null {
  if (typeof MediaRecorder === "undefined") return null;
  const type = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) return null;
  const live = document.createElement("canvas");
  live.width = FW;
  live.height = FH;
  const lg = live.getContext("2d")!;
  const rec = new MediaRecorder(live.captureStream(30), {
    mimeType: type,
    videoBitsPerSecond: 6_000_000,
  });
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  let started = false;
  return {
    add: async (f, ms) => {
      lg.drawImage(f, 0, 0);
      if (!started) {
        rec.start();
        started = true;
      } else rec.resume();
      await new Promise((ok) => setTimeout(ok, ms));
      rec.pause();
    },
    done: () =>
      new Promise<Blob>((ok) => {
        rec.onstop = () => ok(new Blob(parts, { type: type.split(";")[0] }));
        rec.stop();
      }),
  };
}

const png = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, no) =>
    c.toBlob((b) => (b ? ok(b) : no(new Error("empty"))), "image/png"),
  );

/** Make the picture, GIF or video; `progress` hears each frame as it's added. */
export async function make(
  r: Reel,
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  if (r.art && f !== "image") return focused(r, f, progress);
  const draw = await framer(r);
  if (f === "image") {
    const art = await r.art?.(r.at);
    if (art) return png(draw(art, r.at, r.at, r.count));
    await settle(r.map);
    return png(draw(await grab(r.map), r.at, r.at, r.count));
  }
  const sink =
    f === "gif"
      ? await gifSink(FW / 2, FH / 2)
      : ((await mp4Sink(FW, FH)) ?? recordSink(FW, FH));
  if (!sink) throw new Error("no encoder");
  const ks = pickFrames(r.count, f === "gif" ? 30 : 48);
  try {
    for (let i = 0; i < ks.length; i++) {
      progress(i, ks.length);
      if (!(await r.show(ks[i]))) continue;
      await settle(r.map);
      const frame = draw(await grab(r.map), ks[i], i, ks.length);
      await sink.add(frame, i === ks.length - 1 ? r.delay * 3 : r.delay);
    }
    progress(ks.length, ks.length);
    return await sink.done();
  } finally {
    r.restore();
  }
}

/**
 * The map-first frame (models' GIF and video): the model and field with the link along the top,
 * the map full width, the frame's time large under it with a lit timeline. Nothing else.
 */
async function focusFramer(r: Reel, first: HTMLCanvasElement) {
  const t = await tokens();
  const W = 1080;
  const TOP = 96;
  const mapH = Math.round(first.height * (W / first.width));
  const H = even(TOP + mapH + 132);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")! as CanvasRenderingContext2D & {
    letterSpacing?: string;
  };
  const [model, field] = r.brand ?? [r.title, r.sub];
  return (art: HTMLCanvasElement, k: number, idx: number, total: number) => {
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.fillStyle = t.bg;
    g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 620);
    rg.addColorStop(0, t.accent);
    rg.addColorStop(1, "transparent");
    g.globalAlpha = 0.16;
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.textAlign = "left";
    g.font = `800 36px ${t.disp}`;
    g.shadowColor = t.accent;
    g.shadowBlur = 18;
    g.fillStyle = t.text;
    g.fillText(model, 32, 60);
    const mw = g.measureText(model).width;
    g.shadowBlur = 0;
    g.font = `600 22px ${t.sans}`;
    g.fillStyle = t.muted;
    g.fillText(`· ${field}`, 32 + mw + 12, 59, W - mw - 330);
    g.textAlign = "right";
    g.font = `700 16px ${t.sans}`;
    g.letterSpacing = "3px";
    g.fillStyle = t.accent;
    g.fillText("WEATHER.SSWX.SPACE", W - 32, 58);
    g.letterSpacing = "0px";
    g.drawImage(art, 0, TOP, W, mapH);
    g.fillStyle = t.accent;
    g.globalAlpha = 0.6;
    g.shadowColor = t.accent;
    g.shadowBlur = 10;
    g.fillRect(0, TOP - 1, W, 1.5);
    g.fillRect(0, TOP + mapH - 0.5, W, 1.5);
    g.globalAlpha = 1;
    const [time, tag] = r.label(k);
    const y = TOP + mapH;
    g.textAlign = "left";
    g.font = `800 46px ${t.disp}`;
    g.shadowBlur = 20;
    g.fillStyle = t.text;
    g.fillText(time, 32, y + 66, W - 240);
    g.shadowBlur = 0;
    g.font = `800 20px ${t.sans}`;
    g.letterSpacing = "2px";
    const tw = g.measureText(tag).width + 40;
    g.strokeStyle = t.accent;
    g.lineWidth = 2;
    g.shadowBlur = 14;
    g.beginPath();
    g.roundRect(W - 32 - tw, y + 30, tw, 46, 23);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = t.accent;
    g.fillText(tag, W - 32 - tw + 20, y + 60);
    g.letterSpacing = "0px";
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.beginPath();
    g.roundRect(32, y + 98, W - 64, 8, 4);
    g.fill();
    g.fillStyle = t.accent;
    g.shadowBlur = 14;
    g.beginPath();
    g.roundRect(32, y + 98, Math.max(8, ((W - 64) * (idx + 1)) / total), 8, 4);
    g.fill();
    g.shadowBlur = 0;
    return out;
  };
}

/** The map-first GIF or video: sharp frames drawn from the model pictures, cross-faded in video. */
async function focused(
  r: Reel,
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  const ks = pickFrames(r.count, f === "gif" ? 30 : 48);
  const fps = 20;
  let draw: Awaited<ReturnType<typeof focusFramer>> | null = null;
  let sink: Sink | null = null;
  let prev: HTMLCanvasElement | null = null;
  let mix: HTMLCanvasElement | null = null;
  for (let i = 0; i < ks.length; i++) {
    progress(i, ks.length);
    const art = await r.art!(ks[i]);
    if (!art) continue;
    draw ??= await focusFramer(r, art);
    const frame = draw(art, ks[i], i, ks.length);
    if (!sink) {
      sink =
        f === "gif"
          ? await gifSink(720, even((frame.height * 720) / frame.width), true)
          : ((await mp4Sink(frame.width, frame.height, fps)) ??
            recordSink(frame.width, frame.height));
      if (!sink) throw new Error("no encoder");
    }
    const hold = i === ks.length - 1 ? r.delay * 3 : r.delay;
    if (f === "video" && prev && mix) {
      // A short cross-fade, so the loop glides from hour to hour.
      const m = mix.getContext("2d")!;
      for (const a of [0.25, 0.5, 0.75]) {
        m.globalAlpha = 1;
        m.drawImage(prev, 0, 0);
        m.globalAlpha = a;
        m.drawImage(frame, 0, 0);
        await sink.add(mix, 1000 / fps);
      }
      await sink.add(frame, hold - 3000 / fps);
    } else await sink.add(frame, hold);
    if (f === "video") {
      prev ??= Object.assign(document.createElement("canvas"), {
        width: frame.width,
        height: frame.height,
      });
      mix ??= Object.assign(document.createElement("canvas"), {
        width: frame.width,
        height: frame.height,
      });
      prev.getContext("2d")!.drawImage(frame, 0, 0);
    }
  }
  if (!sink) throw new Error("no frames");
  progress(ks.length, ks.length);
  return sink.done();
}
