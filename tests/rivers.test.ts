import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { severity, toGauge, type Gauge } from "@/lib/rivers/data";

const g = (level: Gauge["level"], stage: number): Gauge => ({
  id: "X",
  name: "X",
  river: "",
  state: "",
  level,
  stage,
  units: "ft",
  action: 7,
  flood: 9,
  moderate: 12,
  major: 14,
  observed: null,
  lat: 0,
  lon: 0,
});

describe("river gauges", () => {
  it("ranks by category, then by how far into it", () => {
    expect(severity(g("major", 15))).toBeGreaterThan(
      severity(g("moderate", 13.9)),
    );
    expect(severity(g("minor", 11))).toBeGreaterThan(severity(g("minor", 9.2)));
    expect(severity(g("normal", 5))).toBe(0);
  });

  it("drops thresholds a lake gauge reports on the wrong datum", () => {
    const a = {
      gaugelid: "dvln8",
      status: "major",
      observed: 50.07,
      flood: 0.1,
      moderate: 0.2,
      major: 0.3,
      latitude: 48,
      longitude: -99,
    };
    expect(toGauge(a).flood).toBeNull();
    expect(toGauge({ ...a, observed: 1.2 }).flood).toBe(0.1);
  });
});
