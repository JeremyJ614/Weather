import { describe, expect, it } from "vitest";
import { moonPhase, sunTimes } from "@/lib/weather/astro";

describe("sun", () => {
  it("matches NOAA's times for Norman, OK on Oct 13, 2026 within a few minutes", () => {
    // NOAA solar calculator: sunrise 7:32 CDT (12:32 UTC), sunset 18:58 CDT (23:58 UTC).
    const { rise, set } = sunTimes(
      35.22,
      -97.44,
      new Date("2026-10-13T12:00:00Z"),
    );
    expect(
      Math.abs(rise!.getTime() - Date.parse("2026-10-13T12:32:00Z")),
    ).toBeLessThan(6 * 60000);
    expect(
      Math.abs(set!.getTime() - Date.parse("2026-10-13T23:58:00Z")),
    ).toBeLessThan(6 * 60000);
  });
  it("handles polar day and night", () => {
    expect(sunTimes(78, 15, new Date("2026-06-21T12:00:00Z")).dayMinutes).toBe(
      1440,
    );
    expect(sunTimes(78, 15, new Date("2026-12-21T12:00:00Z")).dayMinutes).toBe(
      0,
    );
  });
});

describe("moon", () => {
  it("is new at the reference and full half a cycle later", () => {
    expect(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))).name).toBe(
      "New Moon",
    );
    const full = moonPhase(
      new Date(Date.UTC(2000, 0, 6, 18, 14) + 14.765 * 86400000),
    );
    expect(full.name).toBe("Full Moon");
    expect(full.illumination).toBeGreaterThan(0.99);
  });
});
