import { describe, expect, it } from "vitest";
import { growBolt, SHAPES } from "@/features/randoms/engines/morph";

// A seeded random source, so the bolt is the same every run.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("growBolt", () => {
  it("grows a main channel from the cloud base to the ground", () => {
    for (const seed of [1, 7, 42, 1234]) {
      const segs = growBolt(seeded(seed));
      const main = segs.filter((s) => s.w === 1);
      expect(main[0].a[1]).toBe(26);
      expect(main[main.length - 1].b[1]).toBe(-30);
      // it steps down every time and stays near the middle of the frame
      for (const s of main) {
        expect(s.b[1]).toBeLessThan(s.a[1]);
        expect(Math.abs(s.b[0])).toBeLessThan(30);
      }
    }
  });

  it("forks into fainter branches and spreads crawlers through the cloud", () => {
    const segs = growBolt(seeded(99));
    const ws = new Set(segs.map((s) => s.w));
    expect([...ws].some((w) => w < 1 && w > 0.22)).toBe(true);
    expect(segs.filter((s) => s.w === 0.22).length).toBeGreaterThanOrEqual(36);
  });

  it("lists the morph's shapes in order", () => {
    expect(SHAPES).toEqual([
      "Tornado",
      "Lightning strike",
      "Saturn",
      "Butterfly",
      "Astrolabe",
      "DNA helix",
    ]);
  });
});
