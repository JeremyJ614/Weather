// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { dbzOf } = await import("@/lib/engines/rainbow");
const { rankOf } = await import("@/lib/engines/places");

describe("Rainbow radar colors", () => {
  it("reads nowCOAST's ramp back to dBZ, and see-through returns as nothing", () => {
    expect(dbzOf(0, 255, 0, 255)).toBe(25);
    expect(dbzOf(0, 236, 236, 255)).toBe(10);
    expect(dbzOf(255, 0, 0, 255)).toBe(55);
    // Between ramp colors: the nearest one.
    expect(dbzOf(1, 250, 2, 255)).toBe(25);
    expect(dbzOf(119, 119, 119, 102)).toBe(0);
  });
});

describe("Deer and Fishing map ranks", () => {
  it("ranks a spot against today's typical one", () => {
    expect([-6, -4, -3, 0, 3, 4, 7, 8, 12].map(rankOf)).toEqual([
      0, 0, 1, 1, 1, 2, 2, 3, 3,
    ]);
  });
});
