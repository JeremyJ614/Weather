import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { statesIn } = await import("@/lib/archive/list");
const { spcDays, spcEvent, scaleOf, SPC_THROUGH } = await import(
  "@/lib/archive/spc"
);

describe("statesIn", () => {
  it("reads state names without mistaking one inside another", () => {
    expect(statesIn("Arkansas · Missouri")).toEqual(["AR", "MO"]);
    expect(statesIn("West Virginia")).toEqual(["WV"]);
    expect(statesIn("Kansas · Oklahoma")).toEqual(["KS", "OK"]);
    expect(statesIn("Iowa to Ohio")).toEqual(["IA", "OH"]);
  });
});

describe("the NWS Surveyed days before 2023", () => {
  const days = spcDays();

  it("stop where the live NWS survey list takes over", () => {
    expect(SPC_THROUGH).toBe("2022-12-31");
    expect(days.every((d) => d.day <= "2023-01-01")).toBe(true);
  });

  it("hold every F4/F5 before 2000 and only significant tornadoes after", () => {
    expect(days.length).toBeGreaterThan(400);
    for (const d of days) {
      const ev = spcEvent(d.id)!;
      expect(ev.torn.length).toBe(d.count);
      const best = Math.max(
        ...ev.torn.map((t) => Number(t.ef.replace("EF", "")) || -1),
      );
      if (d.day < "2000-01-01") expect(best).toBeGreaterThanOrEqual(4);
      else expect(best).toBeGreaterThanOrEqual(2);
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
