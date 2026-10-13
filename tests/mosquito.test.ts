import { expect, it } from "vitest";
import { mosquitoBand, mosquitoHours, mosquitoScore } from "@/lib/air/mosquito";

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
