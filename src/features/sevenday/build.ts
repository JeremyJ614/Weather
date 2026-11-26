/**
 * Turns the daily build's files into pictures on the viewer's device (a worker when it can):
 * the week's total first, from one file, so the map shows at once (owner, Fix it List #40:
 * "it takes a really long time to add up the week"), then the steps for playback, each file
 * holding only what fell since the step before so the running total is added up exactly.
 * Every picture is colored through the owner's ramp, given a soft glow and handed back as a
 * PNG. Playback steps are drawn at half size (a tenth of the work; the total stays sharp), and
 * at full size only when a zoomed-in share asks for them. Runs the same in a worker or on the
 * page.
 */
export type BuildJob =
  | {
      kind: "total";
      /** The total's file, from the CDN first and GitHub after. */
      urls: string[];
      lut: Uint32Array;
      w: number;
      h: number;
    }
  | {
      kind: "steps";
      /** Each step's file. */
      urls: string[][];
      lut: Uint32Array;
      w: number;
      h: number;
      /** 1 for the full 2× canvas, 0.5 for half (playback). */
      scale: number;
      /** Hand back the last step's codes too (builds without a total file). */
      codes?: boolean;
    };
export type Built = { k: number; png: Blob; codes?: Uint8Array };

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function canvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const toPng = (c: Canvas) =>
  "convertToBlob" in c
    ? c.convertToBlob({ type: "image/png" })
    : new Promise<Blob>((ok, no) =>
        (c as HTMLCanvasElement).toBlob(
          (b) => (b ? ok(b) : no(new Error("empty frame"))),
          "image/png",
        ),
      );

/** A file (the CDN first, GitHub after), fetched with up to four tries. */
async function download(urls: string[]) {
  let err: unknown;
  for (let i = 0; i < 4; i++)
    try {
      const url = urls[i % urls.length];
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`${url} ${r.status}`);
      return await r.blob();
    } catch (e) {
      err = e;
    }
  throw err;
}

/** A file's gray codes, read exactly (no color management, no premultiplying). */
async function read(file: Blob, ctx: Ctx, w: number, h: number) {
  const bmp = await createImageBitmap(file, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return ctx.getImageData(0, 0, w, h).data;
}

/** Colors codes into a picture `ow`×`oh` (every `step`th pixel of the `w`-wide grid), with glow. */
function painter(lut: Uint32Array, ow: number, oh: number) {
  const out = canvas(ow, oh);
  const og = out.getContext("2d") as Ctx;
  // The glow: the picture shrunk to a sixth and drawn back over itself, smoothed.
  const glow = canvas(Math.ceil(ow / 6), Math.ceil(oh / 6));
  const gg = glow.getContext("2d") as Ctx;
  const img = new ImageData(ow, oh);
  const px = new Uint32Array(img.data.buffer);
  return (codes: Uint8Array, w: number, step: number) => {
    for (let y = 0, i = 0; y < oh; y++) {
      const row = y * step * w;
      for (let x = 0; x < ow; x++, i++) px[i] = lut[codes[row + x * step]];
    }
    og.globalCompositeOperation = "source-over";
    og.globalAlpha = 1;
    og.clearRect(0, 0, ow, oh);
    og.putImageData(img, 0, 0);
    gg.clearRect(0, 0, glow.width, glow.height);
    gg.imageSmoothingQuality = "high";
    gg.drawImage(out, 0, 0, glow.width, glow.height);
    og.globalCompositeOperation = "lighter";
    og.globalAlpha = 0.38;
    og.imageSmoothingQuality = "high";
    og.drawImage(glow, 0, 0, ow, oh);
    return toPng(out);
  };
}

/** The week's total at full size, with its codes (taps read totals from them). */
export async function buildTotal(
  job: Extract<BuildJob, { kind: "total" }>,
): Promise<Built> {
  const { w, h } = job;
  const src = canvas(w, h);
  const sg = src.getContext("2d", { willReadFrequently: true }) as Ctx;
  const d = await read(await download(job.urls), sg, w, h);
  const codes = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < codes.length; i++, j += 4) codes[i] = d[j];
  return { k: -1, png: await painter(job.lut, w, h)(codes, w, 1), codes };
}

/** Every step's running total in order, `scale` times the full size. */
export async function* buildFrames(
  job: Extract<BuildJob, { kind: "steps" }>,
): AsyncGenerator<Built> {
  const { w, h } = job;
  const step = Math.max(1, Math.round(1 / job.scale));
  const paint = painter(job.lut, Math.floor(w / step), Math.floor(h / step));
  const src = canvas(w, h);
  const sg = src.getContext("2d", { willReadFrequently: true }) as Ctx;
  const codes = new Uint8Array(w * h);
  // Every file is asked for at once (they're small); each is added up as soon as it and the
  // ones before it are in.
  const files = job.urls.map((u) => download(u));
  files.forEach((f) => f.catch(() => {}));
  for (let k = 0; k < job.urls.length; k++) {
    const d = await read(await files[k], sg, w, h);
    for (let i = 0, j = 0; i < codes.length; i++, j += 4) {
      const v = d[j];
      if (v) {
        const c = codes[i] + v;
        codes[i] = c > 255 ? 255 : c;
      }
    }
    const last = k === job.urls.length - 1;
    yield {
      k,
      png: await paint(codes, w, step),
      codes: last && job.codes ? codes.slice() : undefined,
    };
  }
}
