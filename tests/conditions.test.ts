import { describe, expect, it } from "vitest";
import {
  inGeometry,
  pressureTrend,
  spcAt,
  uvNow,
  uvLabel,
} from "@/lib/weather/conditions-math";

const square = (x0: number, y0: number, s: number) =>
  [
    [x0, y0],
    [x0 + s, y0],
    [x0 + s, y0 + s],
    [x0, y0 + s],
    [x0, y0],
  ] as [number, number][];

describe("conditions math", () => {
  it("finds points in polygons with holes", () => {
    const g = {
      type: "Polygon" as const,
      coordinates: [square(0, 0, 10), square(4, 4, 2)],
    };
    expect(inGeometry(1, 1, g)).toBe(true);
    expect(inGeometry(5, 5, g)).toBe(false);
    expect(inGeometry(11, 1, g)).toBe(false);
  });
  it("picks the highest SPC category", () => {
    const feats = [
      {
        properties: { LABEL: "TSTM" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [square(-100, 30, 10)],
        },
      },
      {
        properties: { LABEL: "SLGT" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [square(-98, 34, 2)],
        },
      },
    ];
    expect(spcAt(-97.4, 35.2, feats)).toBe("SLGT");
    expect(spcAt(-95, 31, feats)).toBe("TSTM");
    expect(spcAt(-80, 31, feats)).toBeNull();
  });
  it("reads a 3-hour pressure trend", () => {
    const r = [
      { at: "2026-10-13T12:00:00Z", hpa: 1012.4 },
      { at: "2026-10-13T11:00:00Z", hpa: null },
      { at: "2026-10-13T09:00:00Z", hpa: 1014.0 },
    ];
    expect(pressureTrend(r)).toEqual({ trend: "falling", change: -1.6 });
    expect(pressureTrend(r.slice(0, 2))).toBeNull();
  });
  it("reads EPA UV rows", () => {
    const rows = [
      { DATE_TIME: "Oct/13/2026 11 AM", UV_VALUE: 4 },
      { DATE_TIME: "Oct/13/2026 01 PM", UV_VALUE: 6 },
    ];
    expect(uvNow(rows, 13)).toEqual({ now: 6, max: 6 });
    expect(uvLabel(6)).toBe("High");
  });
});
