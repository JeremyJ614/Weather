import { describe, expect, it } from "vitest";
import {
  bandIndex,
  bust,
  chaseScore,
  lclFt,
  percentile,
  stormMode,
  type Hour,
} from "@/lib/chase/score";

const h: Hour = {
  time: "2026-10-14T20:00:00Z",
  cape: 2500,
  cin: -10,
  li: -6,
  temp: 84,
  dew: 68,
  shear: 45,
  srh: 300,
  stp: 3,
  swti: 70,
  pop: 40,
  lowCloud: 20,
  motionMph: 30,
  motionTo: 60,
  freezingFt: 12000,
};
const spc = { cat: 4, torn: 10, hail: 30, wind: 30 };

describe("chase scoring", () => {
  it("rewards a classic setup and punishes a capped one", () => {
    const good = chaseScore(h, spc, 4);
    const capped = chaseScore({ ...h, cin: -200 }, spc, 4);
    expect(good).toBeGreaterThan(70);
    expect(capped).toBeLessThan(good);
    expect(bandIndex(good)).toBeGreaterThanOrEqual(3);
  });
  it("names the storm mode and the bust risks", () => {
    expect(stormMode(h).mode).toBe("Discrete supercells");
    expect(stormMode({ ...h, shear: 15, cape: 300 }).mode).toBe("Pulse storms");
    const b = bust(
      { ...h, cin: -200, shear: 20 },
      { cat: 2, torn: 0, hail: 5, wind: 5 },
    );
    expect(b.reasons.length).toBe(2);
    expect(b.pct).toBeGreaterThan(60);
  });
  it("estimates cloud base and percentiles", () => {
    expect(lclFt(84, 68)).toBe(3646);
    expect(percentile(50, [10, 50, 90, 20])).toBe(75);
  });
});
