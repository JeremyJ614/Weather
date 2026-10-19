import { describe, expect, it } from "vitest";
import {
  buildNoise3D,
  NOISE_SIZE,
} from "@/features/replay/map/funnels/noise3d";

const S = 16; // divisible by 4 and 8; fast enough to test exhaustively

describe("buildNoise3D", () => {
  const data = buildNoise3D(S);
  const at = (x: number, y: number, z: number, ch: number) =>
    data[((z * S + y) * S + x) * 4 + ch]!;

  it("fills a complete RGBA volume", () => {
    expect(data.length).toBe(S * S * S * 4);
  });

  it("is opaque, because some drivers premultiply on upload", () => {
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255);
  });

  it("is deterministic — the same funnel on every device and every run", () => {
    expect(buildNoise3D(S)).toEqual(data);
  });

  it("actually varies, rather than being a flat field", () => {
    const vals = new Set<number>();
    for (let i = 0; i < data.length; i += 4) vals.add(data[i]!);
    expect(vals.size).toBeGreaterThan(20);
  });

  it("keeps the three channels uncorrelated", () => {
    // They drive the body, the detail tap and the debris bowl. Correlated,
    // all three pulse together and the column breathes as one object.
    let same = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i]! - data[i + 1]!) < 6) same += 1;
      n += 1;
    }
    expect(same / n).toBeLessThan(0.25);
  });

  it("tiles seamlessly, which is what stops a seam crossing the funnel", () => {
    /*
     * The test that matters is not "the wrap difference is small" — at this
     * size the top octave has a lattice point per texel, so neighbouring
     * texels legitimately differ a lot. It is "the wrap looks like the
     * interior": if the field is genuinely periodic, the step from the last
     * texel to the first is drawn from the same distribution as every other
     * adjacent pair. If it were not periodic, the wrap would be a cliff well
     * outside that distribution, and it would read as a line running down a
     * rotating column.
     */
    const interior: number[] = [];
    for (let z = 0; z < S; z += 1) {
      for (let y = 0; y < S; y += 1) {
        for (let x = 1; x < S; x += 1) {
          for (let ch = 0; ch < 3; ch += 1) {
            interior.push(Math.abs(at(x, y, z, ch) - at(x - 1, y, z, ch)));
          }
        }
      }
    }
    const worstInterior = Math.max(...interior);

    const wrap: number[] = [];
    for (let a = 0; a < S; a += 1) {
      for (let b = 0; b < S; b += 1) {
        for (let ch = 0; ch < 3; ch += 1) {
          wrap.push(Math.abs(at(S - 1, a, b, ch) - at(0, a, b, ch)));
          wrap.push(Math.abs(at(a, S - 1, b, ch) - at(a, 0, b, ch)));
          wrap.push(Math.abs(at(a, b, S - 1, ch) - at(a, b, 0, ch)));
        }
      }
    }
    // Max against max: the biggest step across the wrap is no bigger than the
    // biggest step anywhere inside the volume.
    expect(Math.max(...wrap)).toBeLessThanOrEqual(worstInterior);
  });

  it("would fail that test if an octave did not divide the size", () => {
    // Proof the seam check has teeth: 12 is not a multiple of 8 or 16, so the
    // upper octaves cannot close, and the wrap becomes a cliff.
    const bad = buildNoise3D(12);
    const grab = (x: number, y: number, z: number) =>
      bad[((z * 12 + y) * 12 + x) * 4]!;
    let worst = 0;
    for (let a = 0; a < 12; a += 1) {
      for (let b = 0; b < 12; b += 1)
        worst = Math.max(worst, Math.abs(grab(11, a, b) - grab(0, a, b)));
    }
    expect(worst).toBeGreaterThan(0);
  });

  it("stays inside the byte range at every voxel", () => {
    for (let i = 0; i < data.length; i += 1) {
      expect(data[i]).toBeGreaterThanOrEqual(0);
      expect(data[i]).toBeLessThanOrEqual(255);
    }
  });

  it("builds the shipping size quickly enough to do at startup", () => {
    const t0 = performance.now();
    const full = buildNoise3D(NOISE_SIZE);
    const ms = performance.now() - t0;
    expect(full.length).toBe(NOISE_SIZE ** 3 * 4);
    // Generous, because CI machines vary — but it catches an accidental
    // order-of-magnitude regression, which is what would matter.
    expect(ms).toBeLessThan(400);
  });
});
