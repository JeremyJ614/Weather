import "server-only";
import { inflateSync } from "node:zlib";

/**
 * A small PNG decoder for the map frames we read (8-bit palette or RGBA, non-interlaced):
 * chunks → inflate → unfilter. Returns RGBA bytes. Enough to read NOAA's WMS frames
 * pixel by pixel without an image library.
 */
export function decodePng(buf: Buffer) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let type = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (kind === "PLTE") palette = data;
    else if (kind === "tRNS") trns = data;
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace || ![3, 6, 2].includes(type))
    throw new Error(`unsupported PNG ${depth}/${type}/${interlace}`);
  const bpp = type === 3 ? 1 : type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[out + x - bpp] : 0;
      const b = y ? px[out - stride + x] : 0;
      const c = x >= bpp && y ? px[out - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[out + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (type === 3) {
      const k = px[i];
      rgba[i * 4] = palette![k * 3];
      rgba[i * 4 + 1] = palette![k * 3 + 1];
      rgba[i * 4 + 2] = palette![k * 3 + 2];
      rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255;
    } else if (type === 6) px.copy(rgba, i * 4, i * 4, i * 4 + 4);
    else {
      px.copy(rgba, i * 4, i * 3, i * 3 + 3);
      rgba[i * 4 + 3] = 255;
    }
  }
  return { w, h, rgba };
}
