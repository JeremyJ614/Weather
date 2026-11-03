// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { LAT, categoryOf, firstDay, inLower48, outlookAreas } =
  await import("@/lib/engines/outmap");
const { OUTMAP } = await import("@/lib/engines/colors");

describe("Deer and Fishing outlooks", () => {
  it("starts Day 1 today until 8 p.m. Central, then tomorrow", () => {
    // 7:59 p.m. and 8:00 p.m. CDT on 26 Oct 2026 (UTC−5).
    expect(firstDay(Date.UTC(2026, 9, 27, 0, 59))).toBe(Date.UTC(2026, 9, 26));
    expect(firstDay(Date.UTC(2026, 9, 27, 1, 0))).toBe(Date.UTC(2026, 9, 27));
  });

  it("covers the lower 48 and nothing around it", () => {
    expect(inLower48(39, -98)).toBe(true); // Kansas
    expect(inLower48(44.5, -69.5)).toBe(true); // Maine
    expect(inLower48(26, -81)).toBe(true); // the Everglades
    expect(inLower48(25.5, -110.5)).toBe(false); // Baja (where the Hawaii inset sits)
    expect(inLower48(26, -103)).toBe(false); // Mexico
    expect(inLower48(47, -77)).toBe(false); // Ontario
    expect(inLower48(30, -70)).toBe(false); // the Atlantic
  });

  it("files a score under the highest category it reaches", () => {
    const lv = OUTMAP.deer;
    expect(categoryOf(lv[0] - 1, lv)).toBe(-1);
    expect(categoryOf(lv[0], lv)).toBe(0);
    expect(categoryOf(lv[2] + 1, lv)).toBe(2);
    expect(categoryOf(100, lv)).toBe(lv.length - 1);
  });

  it("draws nested SPC-style areas from a lattice", () => {
    const w = Math.round((LAT.E - LAT.W) / LAT.step) + 1;
    const h = Math.round((LAT.N - LAT.S) / LAT.step) + 1;
    const vals = new Float32Array(w * h).fill(NaN);
    // A bullseye over Missouri: 98 in the middle, falling 2 a cell.
    const ci = Math.round((-92.5 - LAT.W) / LAT.step);
    const cj = Math.round((LAT.N - 38.5) / LAT.step);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (inLower48(LAT.N - j * LAT.step, LAT.W + i * LAT.step))
          vals[j * w + i] = 98 - 2 * Math.hypot(i - ci, j - cj);
    const a = outlookAreas(vals, OUTMAP.deer);
    expect(a.features.map((f) => f.properties.band)).toEqual([0, 1, 2, 3, 4]);
    const lons = (b: number) =>
      a.features[b].geometry.coordinates.flat(2).map((p) => p[0]);
    // Higher categories sit inside lower ones.
    expect(Math.min(...lons(4))).toBeGreaterThan(Math.min(...lons(0)));
    expect(Math.max(...lons(4))).toBeLessThan(Math.max(...lons(0)));
    // Rounded to hundredths of a degree.
    for (const x of lons(0)) expect(Math.round(x * 100) / 100).toBe(x);
  });
});

describe("Deer and Fishing storage", () => {
  it("fits every map's id in engine_maps (16 characters at most)", async () => {
    const { rowId } = await import("@/lib/engines/outmap");
    const { SPECIES } = await import("@/lib/engines/outdoor");
    const ids = [rowId("deer"), ...SPECIES.map((s) => rowId("fish", s.id))];
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(16);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
