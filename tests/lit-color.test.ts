import { describe, expect, it } from "vitest";
import { lit } from "@/lib/colors/lit";
import { hourAt, fresh } from "@/lib/sky/gridCore";

describe("lit", () => {
  it("lifts dark colors and keeps light ones", () => {
    expect(lit("#67e8f9")).toBe("#67e8f9");
    expect(lit("#0b0a1f")).toMatch(/^hsl\(24\d, \d+%, 62%\)$/);
    expect(lit("rgb(28, 24, 72)")).toMatch(/62%\)$/);
    expect(lit("not a color")).toBe("not a color");
  });
});

describe("sky forecast hours", () => {
  it("reads Open-Meteo hours as UTC", () => {
    expect(hourAt("2026-11-26T08:00").toISOString()).toBe(
      "2026-11-26T08:00:00.000Z",
    );
    expect(hourAt("2026-11-26T08:00:00Z").toISOString()).toBe(
      "2026-11-26T08:00:00.000Z",
    );
  });
  it("refuses a forecast that has run out", () => {
    const now = Date.parse("2026-11-26T08:00:00Z");
    const h = (last: string) => ({ time: ["2026-11-20T00:00", last] }) as never;
    expect(fresh(h("2026-11-23T23:00"), now)).toBe(false);
    expect(fresh(h("2026-11-28T23:00"), now)).toBe(true);
  });
});

describe("night window", () => {
  it("gives the coming night during dawn twilight, not dashes", async () => {
    const { nightWindow } = await import("@/lib/sky/astro");
    // Chippewa Park, OH: 7:15 AM EST on Nov 26 (sun just under the horizon).
    const n = nightWindow(40.98, -81.86, new Date("2026-11-26T12:15:00Z"));
    expect(n.darkStart).not.toBeNull();
    expect(n.darkStart!.getTime()).toBeGreaterThan(
      Date.parse("2026-11-26T22:00:00Z"),
    );
    expect(n.darkEnd!.getTime()).toBeGreaterThan(n.darkStart!.getTime());
    // 2:50 AM: still the night in progress.
    const m = nightWindow(40.98, -81.86, new Date("2026-11-26T07:50:00Z"));
    expect(m.started).toBe(true);
    expect(m.darkEnd!.getTime()).toBeLessThan(
      Date.parse("2026-11-26T12:00:00Z"),
    );
  });
});
