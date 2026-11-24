import { expect, it } from "vitest";
import {
  mosquitoBand,
  mosquitoHours,
  mosquitoScore,
  mosquitoSeason,
} from "@/lib/air/mosquito";

it("scores the VIP model's four terms", () => {
  const ideal = mosquitoScore(80, 90, 60, 3);
  expect(ideal.parts.temp).toBe(40);
  expect(ideal.parts.humidity).toBe(30);
  expect(ideal.parts.wind).toBe(10);
  expect(ideal.score).toBe(94);
  expect(mosquitoScore(40, 90, 0, 3).parts.temp).toBe(0);
  expect(mosquitoScore(80, 30, 0, 20).parts.wind).toBe(-10);
  expect(mosquitoScore(30, 10, 0, 30).score).toBe(0);
});

it("bands and hours", () => {
  expect(mosquitoBand(85).label).toBe("Very high");
  expect(mosquitoBand(45).label).toBe("Moderate");
  expect(mosquitoBand(3).label).toBe("Very low");
  const h = mosquitoHours(
    [
      {
        start: "2026-07-01T23:00:00Z",
        isDay: false,
        temp: 78,
        pop: 10,
        wind: "S 5 to 10 mph",
        short: "Clear",
        dewF: 66,
        rh: 80,
      },
    ],
    "America/Chicago",
  );
  expect(h[0].hour).toBe(18);
  expect(h[0].wind).toBe(10);
});

const run = (from: string, n: number, max: number, min: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), max, min };
  });

it("scales the index by the local season", () => {
  const nov = new Date("2026-11-18T18:00:00Z");
  // Miami in November: warm all month, a full season.
  const miami = mosquitoSeason(run("2026-10-18", 30, 83, 71), 25.8, nov);
  expect(miami.factor).toBe(1);
  expect(miami.from).toBe("local");
  // Oklahoma City after a hard freeze: the year's season is over, whatever the afternoon.
  const okc = mosquitoSeason(
    [
      ...run("2026-10-18", 25, 72, 50),
      ...run("2026-11-12", 1, 50, 26),
      ...run("2026-11-13", 5, 70, 45),
    ],
    35.4,
    nov,
  );
  expect(okc.factor).toBe(0.1);
  expect(okc.label).toBe("Off season");
  expect(okc.why).toContain("hard freeze");
  // A frost only halves it.
  const frost = mosquitoSeason(
    [...run("2026-10-18", 29, 80, 62), ...run("2026-11-16", 1, 60, 31)],
    33.7,
    nov,
  );
  expect(frost.factor).toBe(0.5);
  // A cool fortnight with no freeze: partly active.
  expect(mosquitoSeason(run("2026-10-18", 30, 63, 47), 33.7, nov).factor).toBe(
    0.5,
  );
  // Spring: a freeze sets them back and they recover over the month.
  const may = new Date("2026-04-20T18:00:00Z");
  const spring = mosquitoSeason(
    [
      ...run("2026-03-21", 15, 75, 55),
      ...run("2026-04-05", 1, 50, 27),
      ...run("2026-04-06", 14, 76, 56),
    ],
    35.4,
    may,
  );
  expect(spring.factor).toBeGreaterThan(0.3);
  expect(spring.factor).toBeLessThan(1);
  // Southern Hemisphere: May is fall there.
  expect(
    mosquitoSeason(
      run("2026-04-20", 30, 70, 25),
      -34.6,
      new Date("2026-05-20T12:00:00Z"),
    ).factor,
  ).toBe(0.1);
  // No record: the forecast stands in.
  const none = mosquitoSeason([], 61.2, nov, [
    {
      start: "2026-11-18T18:00:00Z",
      isDay: true,
      temp: 20,
      pop: 0,
      wind: "N 5 mph",
      short: "Clear",
      dewF: 5,
      rh: 50,
    },
  ]);
  expect(none.from).toBe("forecast");
  expect(none.factor).toBe(0);
  // The hours carry both numbers.
  const h = mosquitoHours(
    [
      {
        start: "2026-07-01T23:00:00Z",
        isDay: false,
        temp: 80,
        pop: 60,
        wind: "S 3 mph",
        short: "Clear",
        dewF: 70,
        rh: 90,
      },
    ],
    "America/Chicago",
    0.5,
  );
  expect(h[0].raw).toBe(94);
  expect(h[0].score).toBe(47);
});
