import { describe, expect, it } from "vitest";
import { derive, wetBulb, yearRank, type Hour } from "@/lib/chase/score";
import { PARAM_GROUPS, betterOf, fillFor, valueOf } from "@/lib/chase/params";

const h: Hour = {
  time: "2026-05-06T22:00:00Z",
  cape: 3000,
  cin: -40,
  li: -7,
  temp: 86,
  dew: 68,
  shear: 50,
  srh: 300,
  stp: 3,
  swti: 75,
  pop: 50,
  lowCloud: 10,
  motionMph: 32,
  motionTo: 60,
  freezingFt: 13000,
  rh700: 50,
  t850: 18,
  t700: 6,
  t500: -14,
  z850: 1500,
  z700: 3100,
  z500: 5800,
  elev: 400,
  pres: 965,
  rh850: 70,
  rh500: 40,
  shear01: 22,
  srh01: 180,
};

describe("chase composites", () => {
  it("works out lapse rates, moisture and the composites", () => {
    const d = derive(h);
    expect(d.lapse75).toBeCloseTo(7.4, 1);
    expect(d.lapse03).toBeGreaterThan(8);
    expect(d.mix).toBeGreaterThan(14);
    expect(d.mix).toBeLessThan(16);
    expect(d.scp).toBeGreaterThan(10);
    expect(d.ehi).toBeCloseTo(5.6, 1);
    expect(d.ship).toBeGreaterThan(1.5);
    expect(d.wbzFt).toBeGreaterThan(7000);
    expect(d.wbzFt).toBeLessThan(12000);
  });

  it("leaves missing levels empty instead of inventing them", () => {
    const old: Hour = { ...h };
    for (const k of [
      "t850",
      "t700",
      "t500",
      "z850",
      "z700",
      "z500",
      "pres",
      "rh850",
      "rh500",
    ] as const)
      delete old[k];
    const d = derive(old);
    expect([d.lapse75, d.lapse03, d.mix, d.ship, d.wbzFt]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    const lapse = PARAM_GROUPS[1].rows.find((r) => r.id === "lapse75")!;
    expect(valueOf(lapse, old)).toBeNull();
  });

  it("matches the usual wet-bulb values", () => {
    expect(wetBulb(20, 50)).toBeCloseTo(13.7, 0);
    expect(wetBulb(0, 100)).toBeCloseTo(0, 0);
  });

  it("fills bars and picks winners by which way is better", () => {
    const cin = PARAM_GROUPS[0].rows.find((r) => r.id === "cin")!;
    expect(fillFor(cin, 0)).toBe(1);
    expect(fillFor(cin, 300)).toBe(0);
    expect(betterOf(cin, 20, 120)).toBe(0);
    const li = PARAM_GROUPS[0].rows.find((r) => r.id === "li")!;
    expect(fillFor(li, -5)).toBe(0.5);
  });

  it("ranks the day against the year", () => {
    const year = Array.from({ length: 100 }, (_, i) => i);
    expect(yearRank(99, year)).toBe(5);
    expect(yearRank(92, year)).toBe(4);
    expect(yearRank(80, year)).toBe(3);
    expect(yearRank(60, year)).toBe(2);
    expect(yearRank(40, year)).toBe(1);
    expect(yearRank(20, [10, 15])).toBe(1);
  });
});
