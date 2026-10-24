import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { HOLD_MIN, surge, surgeBand } from "@/lib/engines/jump";
import { isSevere, judge } from "@/lib/engines/verify";

const at = (rates: number[], step = 2) =>
  rates.map((fr, i) => ({ t: i * step * 60_000, fr }));

describe("lightning jump (2σ)", () => {
  it("flags a sudden rise in a storm already flashing 10+ a minute", () => {
    const s = surge(at([12, 13, 12, 14, 13, 14, 30]));
    expect(s.sigma).toBeGreaterThanOrEqual(2);
    expect(s.peak).toBeGreaterThanOrEqual(2);
    expect(s.since).toBe(0);
    expect(surgeBand(s, false)).toBe(s.peak >= 3 ? 2 : 1);
  });
  it("ignores the same rise in a storm below 10 flashes a minute", () => {
    const s = surge(at([1, 2, 1, 2, 1, 2, 8]));
    expect(s.since).toBeNull();
    expect(s.rising).toBe(true);
    expect(surgeBand(s, false)).toBe(0);
  });
  it("does not call steady, noisy lightning a jump", () => {
    const s = surge(at([20, 28, 19, 27, 21, 26, 22, 27]));
    expect(s.since).toBeNull();
    expect(surgeBand(s, true)).toBe(-1);
  });
  it("needs history before judging", () => {
    expect(surge(at([10, 40])).since).toBeNull();
  });
  it("holds a jump for 10 minutes, then lets it go", () => {
    const rates = [12, 13, 12, 14, 13, 14, 40, 40, 40, 40, 40, 40, 40];
    const early = surge(at(rates.slice(0, 9)));
    expect(early.since).toBe(4);
    expect(surgeBand(early, false)).toBeGreaterThanOrEqual(1);
    const late = surge(at(rates));
    expect(late.since).toBe(12);
    expect(late.since! > HOLD_MIN).toBe(true);
    expect(surgeBand(late, false)).toBe(-1);
  });
  it("raises a backed-up jump to strong", () => {
    const s = surge(at([12, 13, 12, 14, 13, 14, 22]));
    expect(s.since).toBe(0);
    expect(surgeBand(s, true)).toBe(2);
  });
});

describe("checking flags against reports", () => {
  const check = {
    id: 1,
    engine: "surge",
    at: "2026-05-06T21:00:00Z",
    lat: 35,
    lon: -97,
    window_min: 45,
    radius_km: 25,
  };
  const r = (min: number, type: string, mag = 0, dLat = 0) => ({
    t: Date.parse(check.at) + min * 60_000,
    type,
    mag,
    lat: 35 + dLat,
    lon: -97,
  });
  it("counts severe reports by the NWS definition", () => {
    expect(isSevere(r(0, "HAIL", 1))).toBe(true);
    expect(isSevere(r(0, "HAIL", 0.75))).toBe(false);
    expect(isSevere(r(0, "TSTM WND GST", 58))).toBe(true);
    expect(isSevere(r(0, "TSTM WND GST", 50))).toBe(false);
    expect(isSevere(r(0, "TORNADO"))).toBe(true);
  });
  it("needs the report inside the window and radius", () => {
    expect(judge(check, [r(30, "TORNADO")])).toBe(true);
    expect(judge(check, [r(-5, "TORNADO")])).toBe(false);
    expect(judge(check, [r(60, "TORNADO")])).toBe(false);
    expect(judge(check, [r(30, "TORNADO", 0, 0.5)])).toBe(false);
    expect(judge(check, [r(30, "HAIL", 0.5)])).toBe(false);
  });
});
