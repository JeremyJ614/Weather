import { describe, expect, it } from "vitest";
import {
  drawnTrack,
  localEpoch,
  timeRoute,
  type RouteStop,
} from "@/features/replay/import/route";
import { decodePolyline, straightLeg } from "@/features/replay/import/routing";
import { summarise } from "@/features/replay/import/build";

const CHI = "America/Chicago";
// Due north along a meridian: 0.1° of latitude is about 11.1 km.
const at = (lat: number, clock = ""): RouteStop => ({ lat, lon: -97.5, clock });
const legsOf = (stops: RouteStop[]) =>
  stops.slice(1).map((b, i) => straightLeg(stops[i], b));

describe("localEpoch", () => {
  it("reads a local clock in the zone, across daylight saving", () => {
    // 2026-05-20 17:00 CDT (UTC−5) and 2026-01-20 17:00 CST (UTC−6).
    expect(localEpoch("2026-05-20", "17:00", CHI)).toBe(
      Date.UTC(2026, 4, 20, 22) / 1000,
    );
    expect(localEpoch("2026-01-20", "17:00", CHI)).toBe(
      Date.UTC(2026, 0, 20, 23) / 1000,
    );
  });
  it("refuses what is not a date or a time", () => {
    expect(localEpoch("2026-5-20", "17:00", CHI)).toBeNull();
    expect(localEpoch("2026-05-20", "25:00", CHI)).toBeNull();
  });
});

describe("timeRoute", () => {
  it("needs the first and last stops timed", () => {
    const stops = [at(35), at(35.1), at(35.2)];
    const r = timeRoute(stops, legsOf(stops), "2026-05-20", CHI);
    expect(r.fixes).toEqual([]);
    expect(r.problems).toEqual([
      "Give stop 1 the time you set off.",
      "Give stop 3 the time you finished.",
    ]);
  });

  it("times untimed stops by distance between timed ones", () => {
    const stops = [at(35, "16:00"), at(35.1), at(35.3, "16:30")];
    const r = timeRoute(stops, legsOf(stops), "2026-05-20", CHI);
    expect(r.problems).toEqual([]);
    const t0 = localEpoch("2026-05-20", "16:00", CHI)!;
    // A third of the way along, a third of the half hour.
    expect(r.times[1]! - t0).toBeCloseTo(600, 0);
    expect(r.miles).toBeCloseTo(20.7, 0);
    // Fixes run from the first time to the last, in order, a few hundred meters apart.
    expect(r.fixes[0][0]).toBe(t0);
    expect(r.fixes[r.fixes.length - 1][0]).toBe(t0 + 1800);
    expect(r.fixes.length).toBeGreaterThan(80);
    for (let i = 1; i < r.fixes.length; i += 1)
      expect(r.fixes[i][0]).toBeGreaterThanOrEqual(r.fixes[i - 1][0]);
  });

  it("reports a time earlier than the one before, and rolls past midnight", () => {
    const back = [at(35, "16:00"), at(35.1, "15:30"), at(35.2, "17:00")];
    expect(
      timeRoute(back, legsOf(back), "2026-05-20", CHI).problems[0],
    ).toMatch(/Stop 2 \(15:30\) is earlier than stop 1/);
    const late = [at(35, "23:40"), at(35.2, "00:10")];
    const r = timeRoute(late, legsOf(late), "2026-05-20", CHI);
    expect(r.problems).toEqual([]);
    expect(r.times[1]! - r.times[0]!).toBe(1800);
  });

  it("reports a drive too fast to be real", () => {
    const stops = [at(35, "16:00"), at(36, "16:10")];
    expect(
      timeRoute(stops, legsOf(stops), "2026-05-20", CHI).problems[0],
    ).toMatch(/Stop 1 to stop 2 is 69 mi in 10 min/);
  });

  it("waiting in one place keeps the clock moving", () => {
    const stops = [at(35, "16:00"), at(35, "16:20"), at(35.1, "16:40")];
    const r = timeRoute(stops, legsOf(stops), "2026-05-20", CHI);
    expect(r.problems).toEqual([]);
    expect(r.fixes[1][0] - r.fixes[0][0]).toBe(1200);
  });

  it("makes a track the importer accepts", () => {
    const stops = [at(35, "16:00"), at(35.5, "17:00")];
    const legs = legsOf(stops);
    const track = drawnTrack(timeRoute(stops, legs, "2026-05-20", CHI), legs);
    expect(track.notes[0]).toMatch(/1 leg is drawn straight/);
    const sum = summarise(track);
    expect(sum.tz).toBe(CHI);
    expect(sum.day).toBe("2026-05-20");
    expect(sum.warnings.filter((w) => /jump/.test(w))).toEqual([]);
  });
});

describe("decodePolyline", () => {
  it("decodes Google's example at precision 5", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });
});
