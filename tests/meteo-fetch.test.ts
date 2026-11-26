import { describe, expect, it } from "vitest";
import { current } from "@/lib/meteo/fetch";

const now = Date.parse("2026-11-26T12:00:00Z");
describe("Open-Meteo freshness", () => {
  it("accepts a forecast reaching the present (local times with an offset)", () => {
    expect(
      current(
        {
          utc_offset_seconds: -18000,
          hourly: { time: ["2026-11-26T00:00", "2026-11-28T23:00"] },
        },
        now,
      ),
    ).toBe(true);
  });
  it("refuses a run-out copy, single or multi-point", () => {
    const old = { hourly: { time: ["2026-11-20T00:00", "2026-11-22T23:00"] } };
    expect(current(old, now)).toBe(false);
    expect(current([old, old], now)).toBe(false);
  });
  it("judges daily-only and current-only answers", () => {
    expect(
      current({ daily: { time: ["2026-11-26", "2026-11-30"] } }, now),
    ).toBe(true);
    expect(
      current({ daily: { time: ["2026-11-20", "2026-11-24"] } }, now),
    ).toBe(false);
    expect(current({ current: { time: "2026-11-26T11:00" } }, now)).toBe(true);
    expect(current({ current: { time: "2026-11-25T11:00" } }, now)).toBe(false);
  });
  it("lets other answers through", () => {
    expect(current({ error: true }, now)).toBe(true);
  });
});
