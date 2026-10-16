import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  hurricaneNear,
  hurricaneSummary,
  tornadoNear,
  tornadoSummary,
} from "@/lib/climo/server";

describe("climatology", () => {
  it("finds Moore, Oklahoma's two EF5s within 25 miles", () => {
    const n = tornadoNear(35.34, -97.49, 25);
    const dates = n.strongest.filter((t) => t.ef === 5).map((t) => t.date);
    expect(dates).toContain("19990503");
    expect(dates).toContain("20130520");
  });
  it("counts tornadoes once per track and keeps the EF5 total near 60", () => {
    const t = tornadoSummary();
    expect(t.ef[6]).toBeGreaterThanOrEqual(58);
    expect(t.ef[6]).toBeLessThanOrEqual(62);
    expect(t.months.indexOf(Math.max(...t.months))).toBe(4); // May
  });
  it("puts Andrew at the top of Miami's list", () => {
    const n = hurricaneNear(25.76, -80.19, 60);
    expect(n.strongest[0].name).toBe("Andrew");
    expect(n.strongest[0].year).toBe(1992);
  });
  it("matches NOAA's Atlantic ACE for 2024 and the September peak", () => {
    const h = hurricaneSummary();
    expect(h.ace.AL.find((x) => x[0] === 2024)?.[1]).toBeCloseTo(161.6, 0);
    const peak = h.season.AL.indexOf(Math.max(...h.season.AL));
    expect(peak).toBeGreaterThan(240);
    expect(peak).toBeLessThan(262);
  });
});
