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
};

export type Format = "image" | "gif" | "video";

const FW = 1080;
const FH = 1350;
const GIF_W = 540;
const GIF_H = 675;

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

type Sink = {
  add: (frame: HTMLCanvasElement, ms: number) => Promise<void>;
  done: () => Promise<Blob>;
};

async function gifSink(): Promise<Sink> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const small = document.createElement("canvas");
  small.width = GIF_W;
  small.height = GIF_H;
  const sg = small.getContext("2d", { willReadFrequently: true })!;
  return {
    add: async (f, ms) => {
      sg.drawImage(f, 0, 0, GIF_W, GIF_H);
      const { data } = sg.getImageData(0, 0, GIF_W, GIF_H);
      const palette = quantize(data, 256, { format: "rgb444" });
      gif.writeFrame(applyPalette(data, palette, "rgb444"), GIF_W, GIF_H, {
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

/** MP4 from the browser's H.264 encoder: 10 frames a second, the loop's frames held. */
async function mp4Sink(): Promise<Sink | null> {
  if (typeof VideoEncoder === "undefined") return null;
  let config: VideoEncoderConfig | null = null;
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.420028"]) {
    const c = {
      codec,
      width: FW,
      height: FH,
      bitrate: 6_000_000,
      framerate: 10,
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
      for (let r = Math.max(1, Math.round(ms / 100)); r > 0; r--) {
        const vf = new VideoFrame(f, {
          timestamp: n * 100_000,
          duration: 100_000,
        });
        enc.encode(vf, { keyFrame: n % 20 === 0 });
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
function recordSink(): Sink | null {
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
  const draw = await framer(r);
  if (f === "image") {
    await settle(r.map);
    return png(draw(await grab(r.map), r.at, r.at, r.count));
  }
  const sink =
    f === "gif" ? await gifSink() : ((await mp4Sink()) ?? recordSink());
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
