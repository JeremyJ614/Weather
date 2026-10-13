import { expect, it } from "vitest";
import { heatRiskDays, WPC_QPF } from "@/lib/weather/wpc";

it("lists HeatRisk days from the service's time extent", () => {
  const start = Date.parse("2026-10-13T12:00:00Z");
  const days = heatRiskDays([start, start + 6 * 86400000], start + 3600000);
  expect(days).toHaveLength(7);
  expect(heatRiskDays(null)).toEqual([]);
  expect(
    WPC_QPF.every((q) => q.src.startsWith("https://www.wpc.ncep.noaa.gov/")),
  ).toBe(true);
});
