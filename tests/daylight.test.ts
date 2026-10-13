import { expect, it } from "vitest";
import {
  addDays,
  hms,
  keyDays,
  localMinutes,
  sunDay,
  yearDays,
} from "@/lib/weather/daylight";

const KC = { lat: 39.1, lon: -94.58, tz: "America/Chicago" };

it("orders the day's sun events", () => {
  const d = sunDay(KC.lat, KC.lon, "2026-06-21");
  const seq = [
    d.astroDawn,
    d.nauticalDawn,
    d.civilDawn,
    d.rise,
    d.goldenEnd,
    d.noon,
    d.goldenStart,
    d.set,
    d.civilDusk,
    d.nauticalDusk,
    d.astroDusk,
  ].map((x) => x!.getTime());
  expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  expect(d.dayMinutes).toBeGreaterThan(14.5 * 60);
});

it("finds the year's key days", () => {
  const days = yearDays(KC.lat, KC.lon, 2026, KC.tz);
  expect(days).toHaveLength(365);
  const k = keyDays(days);
  expect(k.shortest!.ymd.slice(5, 7)).toBe("12");
  expect(k.longest!.ymd.slice(5, 7)).toBe("06");
  // The earliest sunset comes before the solstice, the latest sunrise after it.
  expect(k.earliestSet!.ymd.slice(5, 7)).toBe("12");
  expect(Number(k.earliestSet!.ymd.slice(8))).toBeLessThan(21);
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(hms(61.5)).toEqual({ h: 1, m: 1, s: 30 });
  expect(localMinutes(new Date("2026-07-01T17:30:00Z"), KC.tz)).toBe(
    12 * 60 + 30,
  );
});
