import { describe, expect, it } from "vitest";
import { kpBand, kpNeeded, viewLineLat } from "@/lib/aurora/style";

describe("aurora", () => {
  it("walks the view line south as Kp rises", () => {
    expect(viewLineLat(0)).toBe(66);
    expect(viewLineLat(5)).toBe(50);
    expect(viewLineLat(6.5)).toBeCloseTo(45);
    expect(viewLineLat(12)).toBe(37);
  });
  it("names the Kp a latitude needs, or none south of 37°", () => {
    expect(kpNeeded(50)).toBe(5);
    expect(kpNeeded(46.9)).toBeCloseTo(6.1);
    expect(kpNeeded(30)).toBeNull();
  });
  it("maps Kp to NOAA G levels", () => {
    expect(kpBand(2.3).g).toBe("G0");
    expect(kpBand(5).g).toBe("G1");
    expect(kpBand(7.7).g).toBe("G3");
    expect(kpBand(9).g).toBe("G5");
  });
});
