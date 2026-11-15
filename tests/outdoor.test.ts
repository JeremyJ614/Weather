import { describe, expect, it } from "vitest";
import {
  SPECIES,
  deerScore,
  fishScore,
  fitWeights,
  glowFactors,
  glowScore,
  rainbowChance,
  rutBoost,
  type DeerHour,
  type FishHour,
} from "@/lib/engines/outdoor";

const sky = {
  low: 5,
  mid: 20,
  high: 40,
  path: [5, 5, 10, 5, 0],
  aot: 0.08,
  rh: 50,
  rained: false,
};

describe("sunset quality", () => {
  it("scores half-cover high cloud with a clear horizon well", () => {
    expect(glowScore(glowFactors(sky))).toBeGreaterThanOrEqual(80);
  });
  it("scores a clear sky and an overcast low deck poorly", () => {
    expect(glowScore(glowFactors({ ...sky, mid: 0, high: 0 }))).toBe(0);
    expect(
      glowScore(glowFactors({ ...sky, low: 100, path: [90, 90, 90, 90, 90] })),
    ).toBeLessThan(10);
  });
  it("likes a little smoke and dislikes a lot", () => {
    const base = glowScore(glowFactors({ ...sky, high: 30 }));
    expect(
      glowScore(glowFactors({ ...sky, high: 30, aot: 0.4 })),
    ).toBeGreaterThan(base);
    expect(glowScore(glowFactors({ ...sky, high: 30, aot: 2 }))).toBeLessThan(
      base,
    );
  });
  it("lets tuned weights change a factor's pull", () => {
    const f = glowFactors({ ...sky, path: [50, 50, 50, 50, 50] });
    expect(glowScore(f, { horizon: 2 })).toBeLessThan(glowScore(f));
  });
});

describe("rainbow chance", () => {
  it("needs the sun up and under 42°", () => {
    expect(rainbowChance(-1, 4, 1)).toBe(0);
    expect(rainbowChance(45, 4, 1)).toBe(0);
    expect(rainbowChance(20, 4, 1)).toBe(100);
  });
  it("needs rain opposite the sun and open sky toward it", () => {
    expect(rainbowChance(20, 0, 1)).toBe(0);
    expect(rainbowChance(20, 1, 1)).toBeLessThan(rainbowChance(20, 3, 1));
    expect(rainbowChance(20, 4, 0)).toBe(0);
  });
});

const deer: DeerHour = {
  fromRise: 0.2,
  fromSet: -11,
  colder: 12,
  dp3: 1.5,
  windMph: 5,
  rainMm: 0,
};

describe("deer activity", () => {
  it("peaks at a cold, calm dawn in the rut", () => {
    const peak = deerScore(deer, 1.5);
    expect(peak).toBeGreaterThan(90);
    expect(deerScore(deer, 1)).toBeLessThanOrEqual(80);
  });
  it("drops at midday, in strong wind and heavy rain", () => {
    expect(deerScore({ ...deer, fromRise: 6, fromSet: -5 }, 1)).toBeLessThan(
      deerScore(deer, 1),
    );
    // With the research weights (A6) wind and rain carry 22% of the score, so a gale and
    // a downpour together take off about 15 points.
    expect(deerScore({ ...deer, windMph: 30, rainMm: 5 }, 1)).toBeLessThan(
      deerScore(deer, 1) - 12,
    );
  });
  it("knows the rut calendar", () => {
    const rut = { pre: "10-25", peak: "11-05", post: "11-21", end: "12-10" };
    expect(rutBoost(new Date("2026-11-10T12:00:00Z"), rut)).toBe(1.5);
    expect(rutBoost(new Date("2026-10-30T12:00:00Z"), rut)).toBe(1.25);
    expect(rutBoost(new Date("2026-12-01T12:00:00Z"), rut)).toBe(1.15);
    expect(rutBoost(new Date("2026-08-01T12:00:00Z"), rut)).toBe(1);
  });
});

const fish: FishHour = {
  fromRise: -0.3,
  fromSet: 11,
  major: 20,
  minor: 300,
  dp3: -1.2,
  windMph: 9,
  cloud: 80,
  water: 62,
};
const walleye = SPECIES.find((s) => s.id === "walleye")!;

describe("fishing bite", () => {
  it("is best at dawn in a major period with pressure falling slowly", () => {
    expect(fishScore(fish, walleye)).toBeGreaterThan(90);
  });
  it("shuts off behind a front and in water out of range", () => {
    expect(fishScore({ ...fish, dp3: 2 }, walleye)).toBeLessThan(
      fishScore(fish, walleye),
    );
    expect(fishScore({ ...fish, water: 85 }, walleye)).toBeLessThan(
      fishScore(fish, walleye),
    );
  });
});

describe("tuning from reports", () => {
  it("leaves the weights alone with few reports", () => {
    expect(fitWeights([], (_, w) => (w.a ?? 1) * 50, ["a"])).toEqual({ a: 1 });
  });
  it("moves a weight toward what the reports say, trusting more with more", () => {
    const model = (f: Record<string, number>, w: Record<string, number>) =>
      100 * f.a ** (w.a ?? 1);
    const rows = Array.from({ length: 200 }, (_, i) => {
      const a = 0.2 + (0.8 * i) / 200;
      return { f: { a }, y: a ** 2 };
    });
    const w = fitWeights(rows, model, ["a"]);
    expect(w.a).toBeGreaterThan(1.5);
    expect(w.a).toBeLessThanOrEqual(2);
  });
});
