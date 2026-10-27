import { decodeTile } from "./decode";

/** One archive tile read back to palette indices, with what it holds. */
export interface Decoded {
  data: Uint8Array;
  w: number;
  h: number;
  /** Pixels with any return, and the strongest index among them. */
  withData: number;
  maxIndex: number;
}

/**
 * A tile image's pixels as palette indices.
 *
 * Decoded byte-exact, which takes saying so twice.
 *
 * This reads pixels back to recover a palette index, so a colour that drifts by
 * one is not a slightly different colour — it is a different measurement, or
 * none. Both the decoder and the canvas will quietly alter it unless told not
 * to: `createImageBitmap` colour-manages and premultiplies by default, and a 2D
 * context will convert to its own colour space on the way in.
 *
 * With the defaults, about one pixel in forty still matched the palette and the
 * rest decoded as no data, so a storm arrived as a scatter of stray returns at
 * thirty below.
 *
 * The size is taken before the bitmap is closed: `ImageBitmap.close()` zeroes
 * its width and height, and a texture sized from them afterwards is 0x0, so the
 * map draws nothing while every step before it looks perfect.
 */
export async function decodeBlob(blob: Blob): Promise<Decoded | null> {
  const bitmap = await createImageBitmap(blob, {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
    colorSpace: "srgb",
  }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h, { colorSpace: "srgb" }).data;
  bitmap.close();

  const data = decodeTile(rgba);
  let withData = 0;
  let maxIndex = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i]! > 0) {
      withData += 1;
      if (data[i]! > maxIndex) maxIndex = data[i]!;
    }
  }
  return { data, w, h, withData, maxIndex };
}
