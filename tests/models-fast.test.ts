// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { locator, rowLocator, type Grid } from "@/lib/models/grib2";
import { MODEL_CITIES } from "@/lib/models/cities";
import { cityValues } from "@/lib/models/render";

// The grids NOAA publishes HRRR/REFS (Lambert conformal, 3 km) and GFS (0.25° lat/lon) on.
const HRRR: Grid = {
  kind: "lambert",
  nx: 1799,
  ny: 1059,
  lat1: 21.138123,
  lon1: 237.280472,
  lad: 38.5,
  lov: 262.5,
  dx: 3000,
  dy: 3000,
  latin1: 38.5,
  latin2: 38.5,
  radius: 6371229,
};
const GFS: Grid = {
  kind: "latlon",
  ni: 1440,
  nj: 721,
  lat1: 90,
  lon1: 0,
  di: 0.25,
  dj: 0.25,
  southward: true,
};

describe("model frames: row-at-a-time grid positions", () => {
  for (const [name, grid] of [
    ["HRRR", HRRR],
    ["GFS", GFS],
  ] as const) {
    it(`match the point-by-point locator exactly on the ${name} grid`, () => {
      const lons = Float64Array.from(
        { length: 257 },
        (_, x) => -134 + x * 0.31,
      );
      const row = rowLocator(grid, lons);
      const one = locator(grid);
      const fi = new Float64Array(lons.length);
      const fj = new Float64Array(lons.length);
      for (let lat = 15.3; lat < 56; lat += 0.73) {
        row(lat, fi, fj);
        lons.forEach((lon, x) => {
          const [i, j] = one(lat, lon);
          expect(fi[x]).toBe(i);
          expect(fj[x]).toBe(j);
        });
      }
    });
  }
});

describe("model frames: city values sent with each frame", () => {
  // A GFS-grid field that reads the same everywhere.
  const flat = (v: number) => ({
    grid: GFS,
    values: new Float32Array(1440 * 721).fill(v),
  });
  const radar = { levels: [5, 20, 40, 60], full: false, clearAbove: false };
  it("one value per map city, rounded like the map's legend", () => {
    const v = cityValues(flat(42.6), radar);
    expect(v).toHaveLength(MODEL_CITIES.length);
    expect(v.every((x) => x === 43)).toBe(true);
    expect(
      cityValues(flat(1.26), { levels: [0.5, 1, 2], full: true }).every(
        (x) => x === 1.3,
      ),
    ).toBe(true);
  });
  it("no number where the map draws nothing", () => {
    expect(cityValues(flat(2), radar).every((x) => x === null)).toBe(true);
    const cin = { levels: [-300, -100, -25], clearAbove: true };
    expect(cityValues(flat(-5), cin).every((x) => x === null)).toBe(true);
  });
});
