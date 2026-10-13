import { describe, expect, it } from "vitest";
import {
  days,
  hazardProbs,
  isNight,
  leader,
  riskIndex,
  RISK,
  threat,
  worstWindow,
} from "@/lib/timing/calc";

describe("storm timing", () => {
  it("scores hazards like VIP and calm air as nothing", () => {
    expect(hazardProbs(0, 0, 0, 5)).toEqual({ tornado: 0, wind: 0, hail: 0 });
    const p = hazardProbs(2500, 300, 50, -6);
    expect(p.tornado).toBeGreaterThan(30);
    expect(p.hail).toBeGreaterThan(p.wind);
    expect(leader({ tornado: 6, wind: 6, hail: 6 })).toBe("tornado");
    // Shear and helicity without instability don't make storms.
    expect(hazardProbs(0, 350, 45, 0)).toEqual({
      tornado: 0,
      wind: 0,
      hail: 0,
    });
    expect(threat(33, 0)).toBe(0);
    expect(threat(33, 2000)).toBe(33);
  });
  it("names the risk band", () => {
    expect(RISK[riskIndex(85)].label).toBe("High");
    expect(RISK[riskIndex(25)].label).toBe("Slight");
    expect(RISK[riskIndex(3)].label).toBe("None");
  });
  it("finds the worst stretch and leaves quiet days unnamed", () => {
    const h = [2, 5, 12, 30, 45, 40, 20, 10, 3].map((swti, i) => ({
      swti,
      time: `2026-10-14T${String(10 + i).padStart(2, "0")}:00`,
    }));
    expect(worstWindow(h)).toEqual({ start: 3, end: 6, peak: 4 });
    expect(worstWindow(h.map((x) => ({ ...x, swti: 5 })))).toBeNull();
    expect(days(h)[0].peak).toBe(45);
  });
  it("knows night from the day's sunrise and sunset", () => {
    const sun = [
      { date: "2026-10-14", rise: "2026-10-14T07:40", set: "2026-10-14T19:05" },
    ];
    expect(isNight("2026-10-14T21:00", sun)).toBe(true);
    expect(isNight("2026-10-14T12:00", sun)).toBe(false);
    expect(isNight("2026-10-15T03:00", sun)).toBe(true);
  });
});
