import { describe, expect, it, vi } from "vitest";
import { levelIndex, probLevel, probStep } from "@/lib/colors/spc";
import { cleanColors, pick } from "@/lib/colors/registry";

vi.mock("server-only", () => ({}));

describe("SPC levels (VIP mapping)", () => {
  it("maps categories onto VIP's 0–5 threat palette", () => {
    expect(levelIndex("cat", false, "TSTM")).toBe(0);
    expect(levelIndex("cat", false, "ENH")).toBe(3);
    expect(levelIndex("cat", false, "HIGH")).toBe(5);
    expect(levelIndex("cat", true, "SLGT")).toBeNull();
  });

  it("uses tornado's own cut points", () => {
    expect(probLevel("torn", 2)).toBe(1);
    expect(probLevel("torn", 10)).toBe(3);
    expect(probLevel("torn", 30)).toBe(5);
    expect(probLevel("hail", 30)).toBe(3);
    expect(levelIndex("torn", false, "0.15")).toBe(3);
  });

  it("draws intensity as the risk area plus CIG groups (hail stops at 2)", () => {
    expect(levelIndex("torn", true, "0.05")).toBe(0);
    expect(levelIndex("torn", true, "CIG3")).toBe(3);
    expect(levelIndex("hail", true, "CIG3")).toBe(2);
    expect(levelIndex("wind", false, "CIG1")).toBeNull();
  });

  it("folds categories and Day 4–8 percents onto the probability scale", () => {
    expect(probStep("TSTM", false)).toBe(1);
    expect(probStep("MDT", false)).toBe(5);
    expect(probStep("HIGH", false)).toBe(5);
    expect(probStep("0.15", true)).toBe(3);
    expect(probStep("0.30", true)).toBe(4);
    expect(probStep("Potential Too Low", true)).toBeNull();
  });
});

describe("color overrides", () => {
  it("keeps only known keys with hex values", () => {
    expect(
      cleanColors({
        "prob:1": "#123abc",
        "prob:9": "#000000",
        "ef:EF5": "red",
        x: 1,
      }),
    ).toEqual({ "prob:1": "#123abc" });
    expect(pick({ "prob:1": "#123abc" }, "prob:1", "#ffffff")).toBe("#123abc");
    expect(pick({}, "prob:1", "#ffffff")).toBe("#ffffff");
  });
});

describe("point in polygon", async () => {
  const { inside } = await import("@/lib/colors/spc-server");
  const square = {
    type: "Polygon",
    coordinates: [
      [
        [-100, 30],
        [-90, 30],
        [-90, 40],
        [-100, 40],
        [-100, 30],
      ],
      [
        [-96, 34],
        [-94, 34],
        [-94, 36],
        [-96, 36],
        [-96, 34],
      ],
    ],
  };
  it("respects holes", () => {
    expect(inside(square as never, -98, 32)).toBe(true);
    expect(inside(square as never, -95, 35)).toBe(false);
    expect(inside(square as never, -80, 35)).toBe(false);
  });
});
