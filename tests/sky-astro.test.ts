import { describe, expect, it } from "vitest";
import { moonPhases, seasonEvents } from "@/lib/sky/astro";
import { planetsTonight } from "@/lib/sky/planets";
import { nextShowers } from "@/lib/sky/showers";

const near = (a: Date, iso: string, min: number) =>
  expect(Math.abs(a.getTime() - Date.parse(iso)) / 60_000).toBeLessThan(min);

describe("astronomy", () => {
  it("places 2026's solstices and equinoxes within half an hour of USNO", () => {
    const e = seasonEvents(2026);
    near(e[0].at, "2026-03-20T14:46:00Z", 30);
    near(e[1].at, "2026-06-21T08:24:00Z", 30);
    near(e[2].at, "2026-09-23T00:05:00Z", 30);
    near(e[3].at, "2026-12-21T20:50:00Z", 30);
  });
  it("finds the October 2026 full moon within half an hour of USNO", () => {
    const full = moonPhases(new Date("2026-10-16T00:00:00Z"), 4).find(
      (p) => p.name === "Full Moon",
    )!;
    near(full.at, "2026-10-26T04:12:00Z", 30);
  });
  it("has Saturn high in the evening near its October 2026 opposition", () => {
    const p = planetsTonight(
      35.47,
      -97.52,
      new Date("2026-10-16T01:00:00Z"),
      new Date("2026-10-16T12:00:00Z"),
    );
    const saturn = p.find((x) => x.name === "Saturn")!;
    expect(saturn.peakAltitude).toBeGreaterThan(45);
    expect(p.find((x) => x.name === "Venus")!.upTonight).toBe(false);
  });
  it("lists the next meteor showers in order", () => {
    const s = nextShowers(new Date("2026-10-16T00:00:00Z"), 3);
    expect(s.map((x) => x.name)).toEqual(["Orionids", "Leonids", "Geminids"]);
  });
});
