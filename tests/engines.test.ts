import { describe, expect, it } from "vitest";
import {
  ahead,
  cone,
  hull,
  motion,
  torOutlook,
  type Cell,
} from "@/lib/engines/project";
import { torBin } from "@/lib/engines/colors";

const ring: [number, number][] = [
  [-97.6, 35.4],
  [-97.4, 35.4],
  [-97.4, 35.6],
  [-97.6, 35.6],
  [-97.6, 35.4],
];
const c: Cell = {
  id: "1",
  lat: 35.5,
  lon: -97.5,
  ring,
  tor: 20,
  wind: 10,
  severe: 50,
  az: 0.012,
  flash: 30,
  jump: false,
  east: 15,
  north: 5,
};

describe("ProbTor outlook", () => {
  it("holds steady with no earlier scan and only fades later", () => {
    const o = torOutlook(c);
    expect(o).toMatchObject({ now: 20, p20: 20, trend: "steady", jump: false });
    expect(o.p40).toBeLessThan(o.p20);
    expect(o.p60).toBeLessThan(o.p40);
  });
  it("rises with tightening rotation and a lightning jump", () => {
    const o = torOutlook(c, { ...c, az: 0.006, flash: 12 });
    expect(o.trend).toBe("rising");
    expect(o.jump).toBe(true);
    expect(o.p20).toBeGreaterThan(20);
    expect(o.p20).toBeLessThanOrEqual(95);
  });
  it("falls when rotation weakens", () => {
    const o = torOutlook(c, { ...c, az: 0.02 });
    expect(o.trend).toBe("falling");
    expect(o.p20).toBeLessThan(20);
  });
  it("caps at 95%", () => {
    expect(torOutlook({ ...c, tor: 90, jump: true }, { ...c, az: 0 }).p20).toBe(
      95,
    );
  });
});

describe("storm motion", () => {
  it("moves east-northeast at the right speed", () => {
    expect(motion(c)).toEqual({ mph: 35, toward: "ENE" });
    const [lon, lat] = ahead(c, 60);
    expect(lon).toBeGreaterThan(c.lon + 0.5);
    expect(lat).toBeCloseTo(c.lat + (5 * 3600) / 111_320, 5);
  });
});

describe("shapes", () => {
  it("builds a closed convex hull", () => {
    const h = hull([...ring, [-97.5, 35.5]]);
    expect(h[0]).toEqual(h.at(-1));
    expect(h).toHaveLength(5);
  });
  it("widens the cone downstream", () => {
    const k = cone(c, 0, 60);
    const lons = k.map((p) => p[0]);
    expect(Math.min(...lons)).toBeLessThan(c.lon);
    expect(Math.max(...lons)).toBeGreaterThan(ahead(c, 60)[0]);
  });
});

describe("bands", () => {
  it("maps tornado odds to color bins", () => {
    expect([3, 9, 10, 45, 80].map(torBin)).toEqual([0, 0, 1, 2, 3]);
  });
});

import { FIELD_BANDS, pyroBin } from "@/lib/engines/colors";

describe("model engine bands", () => {
  it("bins PyroCb chance", () => {
    expect([5, 25, 50, 80].map(pyroBin)).toEqual([0, 1, 2, 3]);
  });
  it("has a color for every band of every model engine", () => {
    for (const b of Object.values(FIELD_BANDS)) {
      expect(b.colors).toHaveLength(b.levels.length);
      expect(b.labels).toHaveLength(b.levels.length);
    }
  });
});
