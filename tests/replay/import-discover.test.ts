import { describe, expect, it } from "vitest";
import {
  drawnStats,
  drawnToTornado,
  routeBounds,
  routeWindow,
  tornadoesNearRoute,
  type DrawnTornado,
} from "@/features/replay/import/discover";
import type { Fix } from "@/features/replay/import/types";
import type { TornadoInput } from "@/features/replay/core/chase";

/** A route running due east along 40N. */
const route: Fix[] = Array.from({ length: 200 }, (_, i) => [
  1_700_000_000 + i * 30,
  40,
  -84 + i * 0.005,
]);

const tornado = (name: string, lat: number, lon: number): TornadoInput => ({
  name,
  ef: "EF2",
  start: 0,
  end: 600,
  coords: [
    [lon, lat],
    [lon + 0.05, lat + 0.02],
  ],
});

describe("finding tornadoes near a route", () => {
  const candidates = [
    tornado("right on it", 40.0, -83.8),
    tornado("ten miles north", 40.145, -83.8),
    tornado("far away", 44.0, -95.0),
  ];

  it("finds only what is inside the radius", () => {
    const near = tornadoesNearRoute(route, candidates, 5).map(
      (r) => r.tornado.name,
    );
    expect(near).toEqual(["right on it"]);
  });

  it("widens with the radius", () => {
    const near = tornadoesNearRoute(route, candidates, 15).map(
      (r) => r.tornado.name,
    );
    expect(near).toContain("right on it");
    expect(near).toContain("ten miles north");
    expect(near).not.toContain("far away");
  });

  it("sorts by how close each one got", () => {
    const near = tornadoesNearRoute(route, candidates, 30);
    for (let i = 1; i < near.length; i += 1) {
      expect(near[i]!.nearestMetres).toBeGreaterThanOrEqual(
        near[i - 1]!.nearestMetres,
      );
    }
  });

  it("reports a distance in the right ballpark", () => {
    const [hit] = tornadoesNearRoute(route, [candidates[1]!], 20);
    // 0.145 degrees of latitude is about 16 km.
    expect(hit!.nearestMetres).toBeGreaterThan(14_000);
    expect(hit!.nearestMetres).toBeLessThan(18_000);
  });

  it("copes with an empty route", () => {
    expect(tornadoesNearRoute([], candidates, 30)).toEqual([]);
  });
});

describe("route extent", () => {
  it("pads the time window either side", () => {
    const w = routeWindow(route, 6)!;
    expect(w.from.getTime()).toBeLessThan(route[0]![0] * 1000);
    expect(w.to.getTime()).toBeGreaterThan(route[route.length - 1]![0] * 1000);
  });

  it("pads the bounding box by miles, not degrees", () => {
    const b = routeBounds(route, 50)!;
    expect(b.minLat).toBeLessThan(40);
    expect(b.maxLat).toBeGreaterThan(40);
    // 50 miles is about 0.72 degrees of latitude.
    expect(40 - b.minLat).toBeCloseTo(0.72, 1);
  });
});

describe("a tornado the user drew", () => {
  const drawn: DrawnTornado = {
    name: "Test cell",
    ef: "EF3",
    // Due east, roughly 20 miles at 40N.
    path: [
      [-84, 40],
      [-83.62, 40],
    ],
    startEpoch: 1_700_000_000,
    speedMph: 40,
    widthYards: 880,
    maxWindMph: 150,
  };

  it("measures the path the user actually drew", () => {
    expect(drawnStats(drawn).lengthMiles).toBeGreaterThan(19);
    expect(drawnStats(drawn).lengthMiles).toBeLessThan(21);
  });

  it("derives duration from the speed that was typed", () => {
    const s = drawnStats(drawn);
    // 20 miles at 40 mph is half an hour.
    expect(s.durationMinutes).toBeCloseTo((s.lengthMiles / 40) * 60, 5);
    expect(s.durationMinutes).toBeGreaterThan(28);
    expect(s.durationMinutes).toBeLessThan(32);
  });

  it("makes the map match the number typed: doubling the speed halves the time", () => {
    const fast = drawnStats({ ...drawn, speedMph: 80 });
    const slow = drawnStats({ ...drawn, speedMph: 40 });
    expect(fast.durationMinutes).toBeCloseTo(slow.durationMinutes / 2, 5);
  });

  it("reports the damage area a survey would", () => {
    const s = drawnStats(drawn);
    // 20 miles by half a mile is about 6,400 acres.
    expect(s.areaAcres).toBeGreaterThan(5_500);
    expect(s.areaAcres).toBeLessThan(7_500);
  });

  it("reports the bearing it was drawn on", () => {
    expect(drawnStats(drawn).bearingDegrees).toBeCloseTo(90, 0);
    expect(
      drawnStats({
        ...drawn,
        path: [
          [-84, 40],
          [-84, 40.3],
        ],
      }).bearingDegrees,
    ).toBeCloseTo(0, 0);
  });

  it("converts into the same shape a surveyed tornado has", () => {
    const t = drawnToTornado(drawn, 1_699_999_000);
    expect(t.start).toBe(1000);
    expect(t.end - t.start).toBeGreaterThan(28 * 60);
    expect(t.end - t.start).toBeLessThan(32 * 60);
    expect(t.widthYd).toBe(880);
    expect(t.maxwind).toBe(150);
    expect(t.ef).toBe("EF3");
  });

  it("refuses to divide by a zero speed", () => {
    expect(
      Number.isFinite(drawnStats({ ...drawn, speedMph: 0 }).durationMinutes),
    ).toBe(true);
  });
});
