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

describe("season stats", () => {
  it("counts, groups and tracks the front", async () => {
    const { seasonStats } = await import("@/lib/weather/foliage");
    const day = (d: number) => Date.UTC(2026, 7, d);
    const site = (lat: number, d: number, sp: number, st: number) =>
      [-80, lat, day(d), sp, 0, st, day(d + 20), 200] as const;
    const r = {
      season: "2026",
      current: true,
      start: "2026-08-01",
      end: "2026-08-31",
      species: ["red maple", "white oak"],
      states: ["ME", "GA"],
      sites: [
        site(45, 2, 0, 0),
        site(45, 3, 0, 0),
        site(44, 4, 1, 0),
        site(33, 16, 1, 1),
        site(32, 17, 1, 1),
        site(31, 18, 0, 1),
      ].map((x) => [...x]) as never,
    };
    const s = seasonStats(r, day(31));
    expect(s.total).toBe(6);
    expect(s.first?.state).toBe("ME");
    expect(s.states.map((g) => g.name).sort()).toEqual(["GA", "ME"]);
    expect(s.lasts).toBe(20);
    const front = s.weeks.filter((w) => w.n >= 3);
    expect(front[0].lat).toBeGreaterThan(front.at(-1)!.lat);
    expect(s.bands.find((b) => b.name === "South")?.n).toBe(3);
  });
});
