import { describe, expect, it } from "vitest";
import { groupSurveys, type Survey } from "@/lib/archive/group";
import {
  MAX_FIXES,
  decodeTrack,
  encodeTrack,
  packChase,
  simplify,
  unpackChase,
} from "@/features/replay/chaselog/codec";
import { mergeDiscovery } from "@/features/replay/chaselog/merge";
import type { Replayable } from "@/features/replay/map/replayable";
import type { DiscoveryBundle } from "@/features/replay/import/sources";
import type { Fix } from "@/features/replay/import/types";
import { zoneAt } from "@/features/replay/core/timezone";

const T = Date.parse("2024-05-21T20:00:00Z") / 1000;
const sv = (
  start: number,
  lon: number,
  lat: number,
  ef = "EF1",
  fat = 0,
): Survey => ({
  start,
  end: start + 600,
  ef,
  wfo: "DMX",
  fat,
  inj: 0,
  lengthMi: 5,
  path: [
    [lon, lat],
    [lon + 0.1, lat + 0.05],
  ],
});
const namer = (lat: number) =>
  lat > 40 ? { place: "Greenfield", st: "IA" } : { place: "Joplin", st: "MO" };

describe("archive grouping", () => {
  it("keeps one storm's tornadoes together and splits distant storms", () => {
    const days = groupSurveys(
      [
        sv(T, -94.5, 41.3, "EF4", 4),
        sv(T + 1800, -94.2, 41.4),
        sv(T + 3600, -93.9, 41.5),
        sv(T + 600, -94.5, 37.1),
      ],
      namer,
      (s) => ({ IA: "Iowa", MO: "Missouri" })[s] ?? s,
    );
    expect(days).toHaveLength(2);
    const ia = days.find((d) => d.region === "Iowa")!;
    expect(ia).toMatchObject({
      count: 3,
      strongest: "EF4",
      fatalities: 4,
      day: "2024-05-21",
      id: "2024-05-21-greenfield-ia",
      tz: "America/Chicago",
    });
    expect(ia.west).toBeLessThan(ia.east);
  });
  it("splits the same place hours apart and keeps ids unique", () => {
    const days = groupSurveys(
      [sv(T, -94.5, 41.3), sv(T + 6 * 3600, -94.5, 41.3)],
      namer,
      (s) => s,
    );
    expect(days.map((d) => d.id).sort()).toEqual([
      "2024-05-21-greenfield-ia",
      "2024-05-21-greenfield-ia-2",
    ]);
  });
});

describe("time zones", () => {
  it("reads the Florida peninsula and Keys as Eastern", () => {
    expect(zoneAt(27.25, -80.33)).toBe("America/New_York");
    expect(zoneAt(25.05, -80.48)).toBe("America/New_York");
    expect(zoneAt(30.4, -87.2)).toBe("America/Chicago");
  });
});

describe("chase codec", () => {
  const fixes: Fix[] = Array.from({ length: 6000 }, (_, i) => [
    T + i * 3,
    35 + i * 0.0003 + Math.sin(i / 40) * 0.002,
    -97 + i * 0.0002,
  ]);
  it("round-trips a track to within a metre and a second", () => {
    const some = fixes.slice(0, 50);
    const back = decodeTrack(encodeTrack(some, T));
    back.forEach(([t, lat, lon], i) => {
      expect(t + T).toBeCloseTo(some[i][0], 0);
      expect(lat).toBeCloseTo(some[i][1], 4);
      expect(lon).toBeCloseTo(some[i][2], 4);
    });
  });
  it("thins long tracks to the cap and keeps both ends", () => {
    const out = simplify(fixes);
    expect(out.length).toBeLessThanOrEqual(MAX_FIXES);
    expect(out[0]).toBe(fixes[0]);
    expect(out.at(-1)).toBe(fixes.at(-1));
  });
  it("packs a chase small enough for the 120 KB row cap", () => {
    const stored = packChase("Test", "America/Chicago", fixes, [
      {
        name: "Test",
        ef: "EF2",
        start: 100,
        end: 700,
        coords: Array.from({ length: 900 }, (_, i) => [-97 + i * 1e-4, 35]),
      },
    ]);
    expect(JSON.stringify(stored).length).toBeLessThan(120_000);
    expect(stored.torn[0].coords.length).toBeLessThanOrEqual(151);
    const p = unpackChase(stored);
    expect(p.T0).toBe(T);
    expect(p.track[0][0]).toBe(0);
  });
});

describe("merging the survey into a stored chase", () => {
  it("re-attaches damage to the kept tornadoes only", () => {
    const r = {
      tornadoes: [{ index: 0, start: 1000, ef: "EF2" }],
      damage: [],
      contours: [],
      hail: [],
      warnings: [],
    } as unknown as Replayable;
    const b = {
      tornadoes: [
        { start: 400, ef: "EF0" },
        { start: 1030, ef: "EF2" },
      ],
      damage: [
        [35, -97, "a", 90, "", "", 0],
        [35, -97, "b", 110, "", "", 1],
      ],
      contours: [{ t: 1, ef: "EF2", ring: [] }],
      hail: [[1, 2, 3, 4, "", "", ""]],
      warnings: [],
      notes: [],
    } as unknown as DiscoveryBundle;
    const m = mergeDiscovery(r, b);
    expect(m.damage).toHaveLength(1);
    expect(m.damage[0][6]).toBe(0);
    expect(m.contours[0].t).toBe(0);
    expect(m.hail).toHaveLength(1);
  });
});
