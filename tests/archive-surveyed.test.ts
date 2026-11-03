import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { statesIn } = await import("@/lib/archive/list");
const { spcDays, spcEvent, scaleOf, SPC_THROUGH } =
  await import("@/lib/archive/spc");

describe("statesIn", () => {
  it("reads state names without mistaking one inside another", () => {
    expect(statesIn("Arkansas · Missouri")).toEqual(["AR", "MO"]);
    expect(statesIn("West Virginia")).toEqual(["WV"]);
    expect(statesIn("Kansas · Oklahoma")).toEqual(["KS", "OK"]);
    expect(statesIn("Iowa to Ohio")).toEqual(["IA", "OH"]);
  });
});

describe("the NWS Surveyed days from SPC's database", () => {
  const days = spcDays();

  it("stop where the live NWS survey list takes over", () => {
    expect(SPC_THROUGH).toBe("2025-12-31");
    expect(days.every((d) => d.day <= "2026-01-01")).toBe(true);
  });

  it("hold every F4/F5 before 2000, significant ones to 2022, and every one since", () => {
    expect(days.length).toBeGreaterThan(400);
    // Every 2024 storm day, January through April included (the old backfill stalled there).
    const months = new Set(
      days
        .filter((d) => d.day.startsWith("2024"))
        .map((d) => d.day.slice(5, 7)),
    );
    expect(months.size).toBe(12);
    for (const d of days) {
      const ev = spcEvent(d.id)!;
      expect(ev.torn.length).toBe(d.count);
      const best = Math.max(
        ...ev.torn.map((t) => Number(t.ef.replace("EF", "")) || -1),
      );
      if (d.day < "2000-01-01") expect(best).toBeGreaterThanOrEqual(4);
      else if (d.day < "2023-01-01") expect(best).toBeGreaterThanOrEqual(2);
    }
  });

  it("time each track from the day's first touchdown", () => {
    const ev = spcEvent(days[0].id)!;
    expect(Math.min(...ev.torn.map((t) => t.start))).toBe(0);
    expect(ev.torn.every((t) => t.end >= t.start)).toBe(true);
  });

  it("rate days before February 2007 on the Fujita scale", () => {
    expect(scaleOf("2007-01-31")).toBe("F");
    expect(scaleOf("2007-02-01")).toBe("EF");
  });
});
