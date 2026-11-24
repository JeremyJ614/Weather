/**
 * Turns the daily build's frames into pictures on the viewer's device (a worker when it can):
 * each file holds only what fell since the step before, so the running total is added up
 * exactly, colored through the owner's ramp, given a soft glow, and handed back as a PNG.
 * Runs the same in a worker or on the page.
 */
export type BuildJob = {
  /** Each frame's file, from the CDN first and GitHub after. */
  urls: string[][];
  lut: Uint32Array;
  w: number;
  h: number;
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

async function read(urls: string[], ctx: Ctx, w: number, h: number) {
  let err: unknown;
  for (let i = 0; i < 4; i++)
    try {
      const url = urls[i % urls.length];
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`${url} ${r.status}`);
      const bmp = await createImageBitmap(await r.blob(), {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      return ctx.getImageData(0, 0, w, h).data;
    } catch (e) {
      err = e;
    }
  throw err;
}

/** Every frame in order; the last one also carries its codes (taps read totals from them). */
export async function* buildFrames(job: BuildJob): AsyncGenerator<Built> {
  const { w, h, lut } = job;
  const src = canvas(w, h);
  const sg = src.getContext("2d", { willReadFrequently: true }) as Ctx;
  const out = canvas(w, h);
  const og = out.getContext("2d") as Ctx;
  // The glow: the frame shrunk to a sixth and drawn back over itself, smoothed.
  const glow = canvas(Math.ceil(w / 6), Math.ceil(h / 6));
  const gg = glow.getContext("2d") as Ctx;
  const codes = new Uint8Array(w * h);
  const img = new ImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  for (let k = 0; k < job.urls.length; k++) {
    const d = await read(job.urls[k], sg, w, h);
    for (let i = 0, j = 0; i < codes.length; i++, j += 4) {
      const v = d[j];
      if (v) {
        const c = codes[i] + v;
        codes[i] = c > 255 ? 255 : c;
      }
      px[i] = lut[codes[i]];
    }
    og.globalCompositeOperation = "source-over";
    og.globalAlpha = 1;
    og.clearRect(0, 0, w, h);
    og.putImageData(img, 0, 0);
    gg.clearRect(0, 0, glow.width, glow.height);
    gg.imageSmoothingQuality = "high";
    gg.drawImage(out, 0, 0, glow.width, glow.height);
    og.globalCompositeOperation = "lighter";
    og.globalAlpha = 0.38;
    og.imageSmoothingQuality = "high";
    og.drawImage(glow, 0, 0, w, h);
    const last = k === job.urls.length - 1;
    yield { k, png: await toPng(out), codes: last ? codes.slice() : undefined };
  }
}
