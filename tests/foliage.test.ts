import { describe, expect, it } from "vitest";
import {
  fallSeason,
  leafColor,
  timeline,
  toReport,
} from "@/lib/weather/foliage";

describe("fall color", () => {
  it("picks the season", () => {
    expect(fallSeason(new Date("2026-10-13T00:00:00Z"))).toMatchObject({
      start: "2026-08-01",
      current: true,
    });
    expect(fallSeason(new Date("2027-01-10T00:00:00Z"))).toMatchObject({
      start: "2026-08-01",
      current: true,
    });
    expect(fallSeason(new Date("2027-05-10T00:00:00Z"))).toMatchObject({
      end: "2026-12-31",
      current: false,
    });
  });
  it("keeps real onsets only and indexes species", () => {
    const s = fallSeason(new Date("2026-10-13T00:00:00Z"));
    const r = toReport(
      [
        {
          latitude: 43,
          longitude: -70,
          common_name: "red maple",
          phenophase_id: 498,
          mean_first_yes_year: 2026,
          mean_first_yes_doy: 260,
        },
        {
          latitude: 44,
          longitude: -71,
          common_name: "red maple",
          phenophase_id: 499,
          mean_first_yes_year: 2026,
          mean_first_yes_doy: 250,
        },
        {
          latitude: 44,
          longitude: -71,
          common_name: "x",
          phenophase_id: 498,
          mean_first_yes_year: -9999,
          mean_first_yes_doy: -9999,
        },
      ],
      s,
    );
    expect(r.species).toEqual(["red maple"]);
    expect(r.sites.map((x) => x[4])).toEqual([1, 0]);
  });
  it("builds a 3-day timeline ending on the last day", () => {
    const t = timeline("2026-08-01", "2026-08-08");
    expect(t.map((x) => new Date(x).toISOString().slice(5, 10))).toEqual([
      "08-01",
      "08-04",
      "08-07",
      "08-08",
    ]);
    expect(leafColor(0)).not.toBe(leafColor(42));
  });
});
