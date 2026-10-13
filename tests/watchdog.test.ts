import { describe, expect, it } from "vitest";
import { QUOTA, assess, shouldAlert, utcMonth } from "@/lib/ops/watchdog";

describe("storage watchdog", () => {
  it("rates the worse of database and storage", () => {
    expect(assess(0.1 * QUOTA.dbBytes, 0).level).toBe("ok");
    expect(assess(0.6 * QUOTA.dbBytes, 0).level).toBe("warn");
    expect(assess(0, 0.85 * QUOTA.storageBytes).level).toBe("critical");
  });

  it("emails once per level per month, again only when worse", () => {
    expect(shouldAlert(null, "ok", "2026-10")).toBe(false);
    expect(shouldAlert(null, "warn", "2026-10")).toBe(true);
    const warned = { month: "2026-10", level: "warn" as const };
    expect(shouldAlert(warned, "warn", "2026-10")).toBe(false);
    expect(shouldAlert(warned, "critical", "2026-10")).toBe(true);
    expect(shouldAlert(warned, "warn", "2026-11")).toBe(true);
  });

  it("uses the UTC month", () => {
    expect(utcMonth(new Date("2026-10-31T23:30:00-05:00"))).toBe("2026-11");
  });
});
