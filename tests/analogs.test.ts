import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { chances, severeCount } from "@/lib/analogs/analogs";
import meta from "@/lib/analogs/meta.json";

describe("severe analogs", () => {
  it("turns the matched days into chances", () => {
    const days = [5, 12, 30, 60, 0, 11].map((n, i) => ({
      day: `2010-05-0${i + 1}`,
      dist: i,
      n,
      torn: n > 20 ? 4 : 0,
    }));
    expect(chances(days)).toEqual({
      p10: 4 / 6,
      p25: 2 / 6,
      p50: 1 / 6,
      torn: 1.3,
    });
    expect(chances([])).toMatchObject({ p10: 0, torn: 0 });
  });
  it("counts severe reports the way the archive does", () => {
    expect(
      severeCount([
        { kind: "torn", mag: 0 },
        { kind: "hail", mag: 75 },
        { kind: "hail", mag: 100 },
        { kind: "wind", mag: 0 },
        { kind: "wind", mag: 50 },
        { kind: "wind", mag: 60 },
      ]),
    ).toBe(4);
  });
  it("covers the Lower 48 since 2004 with a fingerprint per day", () => {
    expect(meta.start).toBe("2004-01-01");
    expect(meta.lats).toHaveLength(11);
    expect(meta.lons).toHaveLength(25);
    expect(meta.f).toBe(meta.fields.length * 11 * 25);
    expect(meta.days).toBeGreaterThan(7600);
    expect(meta.explained).toBeGreaterThan(0.5);
  });
});
