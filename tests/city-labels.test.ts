import { describe, expect, it } from "vitest";
import { pickCities, type City } from "@/lib/map/cityLabels";

const W = 975;
const grid: City[] = Array.from({ length: 400 }, (_, i) => [
  `Town ${i}`,
  (i % 20) * 48 + 5,
  Math.floor(i / 20) * 30 + 5,
]);

describe("city labels", () => {
  it("draws none for the whole country", () => {
    expect(pickCities(grid, { x: 0, y: 0, w: W, h: 610 }, W)).toEqual([]);
  });
  it("gets denser the further in, only on screen, never overlapping", () => {
    const mid = pickCities(grid, { x: 0, y: 0, w: W / 2, h: 305 }, W);
    const deep = pickCities(grid, { x: 0, y: 0, w: W / 6, h: 102 }, W);
    expect(mid.length).toBeGreaterThan(0);
    expect(deep.length / (W / 6) ** 2).toBeGreaterThan(
      mid.length / (W / 2) ** 2,
    );
    for (const [, x, y] of deep) {
      expect(x).toBeLessThanOrEqual(W / 6);
      expect(y).toBeLessThanOrEqual(102);
    }
  });
});
