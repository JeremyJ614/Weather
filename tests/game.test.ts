import { describe, expect, it } from "vitest";
import {
  gameDate,
  parseReports,
  QUIET_DAY_BONUS,
  rankedAwards,
  roundScoresAt,
  secondsToReset,
  scoreSevere,
  scoreTornado,
  type Report,
} from "@/lib/game/score";

const okc: Report = { lat: 35.47, lon: -97.52, kind: "torn" };
const hail: Report = { lat: 39.1, lon: -94.58, kind: "hail" };

it("ranks a field, sharing ties", () => {
  expect(rankedAwards([10, 5, null, 5, 30], [1000, 750, 500])).toEqual([
    500, 1000, 0, 1000, 0,
  ]);
});

it("scores severe pins as a contest with distance consolation", () => {
  const pins = Array.from({ length: 7 }, (_, i) => ({
    lat: 39.1 + i * 0.3,
    lon: -94.58,
    tor: null,
  }));
  const s = scoreSevere(pins, [hail]);
  expect(s.slice(0, 5)).toEqual([1000, 950, 750, 500, 250]);
  expect(s[5]).toBeGreaterThan(0); // ~124 mi away → consolation
  expect(scoreSevere(pins, [])).toEqual(pins.map(() => 0));
});

it("scores tornado pins, bullseyes and quiet-day calls", () => {
  const pins = [
    { lat: 0, lon: 0, tor: { lat: 35.5, lon: -97.5 } },
    { lat: 0, lon: 0, tor: { lat: 40, lon: -90 } },
    { lat: 0, lon: 0, tor: null },
  ];
  expect(scoreTornado(pins, [okc])).toEqual([1500, 750, 0]);
  expect(scoreTornado(pins, [])).toEqual([0, 0, QUIET_DAY_BONUS]);
});

it("reads SPC report CSVs and the Eastern contest clock", () => {
  const csv =
    "Time,F_Scale,Location,County,State,Lat,Lon,Comments\n1955,UNK,2 N X,Y,OK,35.47,-97.52,ok\nTime,F_Scale,Location,County,State,Lat,Lon,Comments\n";
  expect(parseReports(csv, "torn")).toEqual([
    { lat: 35.47, lon: -97.52, kind: "torn" },
  ]);
  expect(gameDate(new Date("2026-10-14T02:00:00Z"))).toBe("2026-10-13");
  // 11:30 PM EDT → 30 minutes to the reset; 1 AM EDT → 23 hours.
  expect(secondsToReset(new Date("2026-10-14T03:30:00Z"))).toBe(1800);
  expect(secondsToReset(new Date("2026-10-13T05:00:00Z"))).toBe(23 * 3600);
});

describe("roundScoresAt", () => {
  it("is half an hour after SPC's storm day closes, the next morning", () => {
    expect(roundScoresAt("2026-11-01").toISOString()).toBe(
      "2026-11-02T12:30:00.000Z",
    );
    // Month and year ends roll over.
    expect(roundScoresAt("2026-12-31").toISOString()).toBe(
      "2027-01-01T12:30:00.000Z",
    );
  });
});
