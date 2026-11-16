import { describe, expect, it } from "vitest";
import { lineage } from "@/lib/engines/lineage";
import { sigmaLevel } from "@/lib/engines/jump";
import type { Cell } from "@/lib/engines/project";

const box = (lat: number, lon: number, r = 0.1): [number, number][] => [
  [lon - r, lat - r],
  [lon + r, lat - r],
  [lon + r, lat + r],
  [lon - r, lat + r],
];
const cell = (
  id: string,
  lat: number,
  lon: number,
  flash: number,
  size = 100,
): Cell => ({
  id,
  lat,
  lon,
  ring: box(lat, lon),
  tor: 0,
  wind: 0,
  severe: 50,
  az: 0,
  flash,
  jump: false,
  east: 10,
  north: 0,
  size,
});

describe("storm lineage", () => {
  it("follows a storm that kept its ID and moved", () => {
    // 10 m/s east for 10 minutes is 6 km.
    const l = lineage(
      [cell("a", 35, -97, 12)],
      [{ id: "a", fr: 10, lat: 35, lon: -97.066 }],
      600_000,
    );
    expect(l.get("a")).toMatchObject({
      fr: 10,
      main: "a",
      merged: false,
      split: false,
    });
  });

  it("adds both parts of a merger, so it is not a jump", () => {
    const l = lineage(
      [cell("new", 35, -97, 30)],
      [
        { id: "x", fr: 14, lat: 35.05, lon: -97.03 },
        { id: "y", fr: 15, lat: 34.95, lon: -97.03 },
      ],
      120_000,
    );
    expect(l.get("new")).toMatchObject({ fr: 29, merged: true });
  });

  it("shares a parent's rate between the halves of a split by area", () => {
    const a = { ...cell("a", 35, -97, 10, 300), ring: box(35, -97, 0.3) };
    const b = {
      ...cell("b", 35.05, -96.95, 10, 100),
      ring: box(35.05, -96.95, 0.2),
    };
    const l = lineage(
      [a, b],
      [{ id: "a", fr: 20, lat: 35.02, lon: -96.98 }],
      60_000,
    );
    expect(l.get("a")!.fr).toBeCloseTo(15);
    expect(l.get("b")!.fr).toBeCloseTo(5);
    expect(l.get("b")!.split).toBe(true);
  });

  it("gives jump sizes as levels", () => {
    expect([1.9, 2, 2.9, 3.4, 4, 7].map(sigmaLevel)).toEqual([
      0, 2, 2, 3, 4, 4,
    ]);
  });
});
