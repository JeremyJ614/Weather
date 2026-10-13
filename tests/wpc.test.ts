import { expect, it } from "vitest";
import { heatRiskDays } from "@/lib/weather/wpc";
import { colorFor, legendFor, VECTOR } from "@/lib/map/products";
import { project, canvasToAlbers } from "@/lib/map/usAlbers";
import { geoPath } from "@/lib/map/geo";

it("lists HeatRisk days from the service's time extent", () => {
  const start = Date.parse("2026-10-13T12:00:00Z");
  const days = heatRiskDays([start, start + 6 * 86400000], start + 3600000);
  expect(days).toHaveLength(7);
  expect(heatRiskDays(null)).toEqual([]);
});

it("colors national map products", () => {
  expect(colorFor("qpf", { qpf: 0.5 })).toBe("#a9e34b");
  expect(colorFor("qpf", { qpf: 0 })).toBeNull();
  expect(colorFor("cpcTemp", { cat: "EC", prob: 33 })).toBeNull();
  expect(colorFor("cpcTemp", { cat: "Above", prob: 50 })).toBe("#ff8787");
  expect(colorFor("drought", { outlook: "No_Drought" })).toBeNull();
  expect(legendFor("ero")).toHaveLength(4);
  expect(new Set(VECTOR.map((v) => v.id)).size).toBe(VECTOR.length);
});

it("projects onto the Albers USA canvas", () => {
  const kc = project(-94.58, 39.1); // Kansas City, near the middle
  expect(kc.x).toBeGreaterThan(500);
  expect(kc.x).toBeLessThan(600);
  const d = geoPath({
    type: "Polygon",
    coordinates: [
      [
        [-100, 35],
        [-90, 35],
        [-90, 40],
        [-100, 40],
        [-100, 35],
      ],
    ],
  });
  expect(d.startsWith("M")).toBe(true);
  expect(d.endsWith("Z")).toBe(true);
  // The raster bbox is ordered (west < east, south < north).
  const [x0, y0] = canvasToAlbers(0, 610);
  const [x1, y1] = canvasToAlbers(975, 0);
  expect(x0).toBeLessThan(x1);
  expect(y0).toBeLessThan(y1);
});
