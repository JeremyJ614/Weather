import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Li and Pomeroy blowing-snow threshold", () => {
  it("drops with cold to a low near −27 °C", async () => {
    const { blowThreshold } = await import("@/lib/engines/fields");
    expect(blowThreshold(-5)).toBeCloseTo(8.61, 1);
    expect(blowThreshold(-27)).toBeLessThan(blowThreshold(-5));
    expect(blowThreshold(-27)).toBeCloseTo(6.98, 1);
    expect(blowThreshold(-40)).toBeGreaterThan(blowThreshold(-27));
  });
});
