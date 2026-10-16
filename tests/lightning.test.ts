import { describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
vi.mock("server-only", () => ({}));
import { decodePng } from "@/lib/lightning/png";
import { classOf, LT_CLASSES, ltBand } from "@/lib/lightning/style";

const crc = (b: Buffer) => {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

/** A 3×2 palette PNG, rows with Sub and Up filters, index 0 transparent. */
function palettePng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(3, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const raw = Buffer.from([1, 0, 1, 1, 2, 0, 1, 0]); // row 0 Sub: 0,1,2 · row 1 Up: 0,2,2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", Buffer.from([0, 0, 0, 255, 0, 0, 0, 0, 255])),
    chunk("tRNS", Buffer.from([0])),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("lightning", () => {
  it("decodes palette PNGs through their row filters", () => {
    const { w, h, rgba } = decodePng(palettePng());
    expect([w, h]).toEqual([3, 2]);
    const px = (i: number) => [...rgba.subarray(i * 4, i * 4 + 4)];
    expect(px(0)[3]).toBe(0);
    expect(px(1)).toEqual([255, 0, 0, 255]);
    expect(px(2)).toEqual([0, 0, 255, 255]);
    expect(px(4)).toEqual([0, 0, 255, 255]);
  });
  it("reads NOAA's classes back from their colors", () => {
    LT_CLASSES.forEach((c, i) => expect(classOf(...c.rgb, 255)).toBe(i));
    expect(classOf(255, 0, 0, 0)).toBe(-1);
    expect(classOf(30, 30, 30, 255)).toBe(-1);
    expect(ltBand(0).key).toBe("light");
    expect(ltBand(16).key).toBe("extreme");
  });
});
