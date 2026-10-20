import { describe, expect, it } from "vitest";
import { contours, ringArea } from "@/lib/map/contour";

const grid = (rows: string[]) => ({
  w: rows[0].length,
  h: rows.length,
  v: rows.flatMap((r) => [...r].map(Number)),
});

describe("contours", () => {
  it("rings a block of high values with one outer ring", () => {
    const g = grid(["00000", "01110", "01110", "01110", "00000"]);
    const p = contours(g.v, g.w, g.h, 0.5, { smooth: 0 });
    expect(p).toHaveLength(1);
    expect(p[0]).toHaveLength(1);
    const xs = p[0][0].map(([x]) => x);
    // Edges sit halfway between the 0 and 1 cells: x from 1 to 4.
    expect(Math.min(...xs)).toBeCloseTo(1);
    expect(Math.max(...xs)).toBeCloseTo(4);
    expect(ringArea(p[0][0])).toBeGreaterThan(0);
  });

  it("keeps a hole inside its polygon", () => {
    const g = grid([
      "0000000",
      "0111110",
      "0111110",
      "0110110",
      "0111110",
      "0111110",
      "0000000",
    ]);
    const p = contours(g.v, g.w, g.h, 0.5, { minArea: 0, smooth: 0 });
    expect(p).toHaveLength(1);
    expect(p[0]).toHaveLength(2);
    expect(ringArea(p[0][1])).toBeLessThan(0);
  });

  it("nests higher thresholds inside lower ones and closes at the edges", () => {
    const g = grid(["12321", "23432", "34543", "23432", "12321"]);
    const lo = contours(g.v, g.w, g.h, 2.5);
    const hi = contours(g.v, g.w, g.h, 4.5, { minArea: 0 });
    expect(lo).toHaveLength(1);
    expect(hi).toHaveLength(1);
    const span = (r: number[][]) =>
      Math.max(...r.map(([x]) => x)) - Math.min(...r.map(([x]) => x));
    expect(span(hi[0][0])).toBeLessThan(span(lo[0][0]));
    for (const r of [lo[0][0], hi[0][0]]) expect(r.at(-1)).toEqual(r[0]);
  });

  it("drops specks smaller than the minimum area", () => {
    const g = grid(["000", "010", "000"]);
    expect(contours(g.v, g.w, g.h, 0.5, { minArea: 2 })).toEqual([]);
  });
});
