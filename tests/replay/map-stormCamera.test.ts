import { describe, expect, it } from "vitest";
import type { PreparedTornado } from "@/features/replay/core/chase";
import {
  glide,
  stormBounds,
  tornadoesInFrame,
} from "@/features/replay/map/stormCamera";

/** A tornado running due east from a point, 0.2° of longitude, from `start` to `end`. */
function tornado(
  lat: number,
  lon: number,
  start: number,
  end: number,
  over: Partial<PreparedTornado> = {},
): PreparedTornado {
  const coords: [number, number][] = [
    [lon, lat],
    [lon + 0.2, lat],
  ];
  return {
    index: 0,
    name: "Test",
    ef: "EF2",
    start,
    end,
    coords,
    cum: [0, 17_000],
    lengthM: 17_000,
    widthYd: 300,
    maxwind: 130,
    injuries: 0,
    fatalities: 0,
    speedMs: 15,
    ...over,
  };
}

const centre = (b: [[number, number], [number, number]]) => [
  (b[0][0] + b[1][0]) / 2,
  (b[0][1] + b[1][1]) / 2,
];
const spanKm = (b: [[number, number], [number, number]]) =>
  (b[1][1] - b[0][1]) * 111.32;

describe("the storm camera", () => {
  it("frames the tornado on the ground, and leads it along its track", () => {
    const t = tornado(35, -98, 0, 1200);
    const b = stormBounds([t], 300)!;
    expect(b).not.toBeNull();
    // A quarter of the way along, heading east: the frame's centre is ahead of it.
    const [cx] = centre(b);
    expect(cx).toBeGreaterThan(-98 + 0.05);
  });

  it("keeps a few miles of country around a single tornado", () => {
    const b = stormBounds([tornado(35, -98, 0, 1200)], 300)!;
    expect(spanKm(b)).toBeGreaterThanOrEqual(10);
  });

  it("widens to take in every tornado on the ground", () => {
    const a = tornado(35, -98, 0, 1200);
    const far = tornado(36, -96, 0, 1200);
    const b = stormBounds([a, far], 300)!;
    expect(b[0][0]).toBeLessThanOrEqual(-98);
    expect(b[1][0]).toBeGreaterThanOrEqual(-96);
    expect(b[0][1]).toBeLessThanOrEqual(35);
    expect(b[1][1]).toBeGreaterThanOrEqual(36);
  });

  it("gives a wide tornado room in proportion to its width", () => {
    const narrow = stormBounds(
      [tornado(35, -98, 0, 1200, { widthYd: 100 })],
      300,
    )!;
    const wedge = stormBounds(
      [tornado(35, -98, 0, 1200, { widthYd: 4500 })],
      300,
    )!;
    expect(spanKm(wedge)).toBeGreaterThan(spanKm(narrow));
  });

  it("waits at the next touchdown when nothing is on the ground", () => {
    const later = tornado(35, -98, 1000, 2000);
    expect(tornadoesInFrame([later], 0)).toEqual([later]);
    const [cx, cy] = centre(stormBounds([later], 0)!);
    expect(cy).toBeCloseTo(35, 1);
    expect(cx).toBeLessThan(-97.9 + 0.12);
  });

  it("holds where it is when nothing is on the ground or coming soon", () => {
    const muchLater = tornado(35, -98, 5000, 6000);
    const long = tornado(35, -98, 0, 100);
    expect(stormBounds([muchLater, long], 2000)).toBeNull();
  });

  it("glides by real time, so its pace does not depend on the frame rate", () => {
    // Two half-frames cover the same ground as one whole one.
    const one = glide(1 / 30);
    const half = glide(1 / 60);
    expect(1 - (1 - half) ** 2).toBeCloseTo(one, 10);
    expect(glide(0)).toBe(0);
    expect(glide(10)).toBeGreaterThan(0.99);
  });
});
