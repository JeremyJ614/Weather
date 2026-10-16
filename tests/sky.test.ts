import { describe, expect, it } from "vitest";
import {
  air,
  bandOf,
  bestPair,
  bestRun,
  cloudCover,
  darkness,
  moonCost,
  skyScore,
} from "@/lib/sky/score";

describe("stargazing score", () => {
  it("needs real darkness", () => {
    expect(darkness(-3)).toBe(0);
    expect(darkness(-12)).toBeCloseTo(0.5);
    expect(darkness(-20)).toBe(1);
  });
  it("lets thin high cloud through more than a low deck", () => {
    const high = cloudCover({ cloud: 80, low: 0, mid: 0, high: 80 });
    const low = cloudCover({ cloud: 80, low: 80, mid: 0, high: 0 });
    expect(high).toBeLessThan(low);
    expect(cloudCover({ cloud: 40 })).toBeCloseTo(0.4);
  });
  it("charges for a bright moon only while it is up", () => {
    expect(moonCost(-10, 1)).toBe(1);
    expect(moonCost(40, 1)).toBeCloseTo(0.15);
    expect(moonCost(40, 0)).toBe(1);
  });
  it("treats rain and haze as bad air", () => {
    expect(air(50, 1)).toBe(0.15);
    expect(air(40, 0, 3000)).toBeLessThan(air(40, 0, 20000));
  });
  it("scores a clear, dark, moonless midnight high and a cloudy one low", () => {
    // 2026-01-18 06 UTC: new moon, deep night over Kansas.
    const at = new Date("2026-01-18T06:00:00Z");
    const clear = skyScore({
      at,
      lat: 38.5,
      lon: -98,
      cloud: 0,
      low: 0,
      mid: 0,
      high: 0,
      rh: 40,
      precip: 0,
      vis: 24000,
    });
    const cloudy = skyScore({
      at,
      lat: 38.5,
      lon: -98,
      cloud: 100,
      low: 100,
      mid: 50,
      high: 0,
      rh: 90,
      precip: 0,
      vis: 24000,
    });
    expect(clear.score).toBeGreaterThan(90);
    expect(cloudy.score).toBe(0);
    expect(cloudy.limiting?.key).toBe("cloud");
    expect(bandOf(clear.score).key).toBe("pristine");
  });
  it("finds the best dark pair and the longest good run", () => {
    const t = (h: number) => new Date(Date.UTC(2026, 0, 18, h));
    const hours = [10, 70, 80, 90, 30, 85].map((score, h) => ({
      at: t(h),
      score,
    }));
    expect(bestPair(hours, () => true)?.score).toBe(85);
    expect(bestPair(hours, (at) => at.getUTCHours() !== 3)?.score).toBe(75);
    expect(bestRun(hours, 60)?.hours).toBe(3);
    expect(bestPair(hours, () => false)).toBeNull();
  });
});
