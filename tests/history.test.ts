import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { linePath, warnTier } from "@/lib/history/data";

describe("severe weather history", () => {
  it("ranks warning severity from IEM's impact tags", () => {
    expect(warnTier({})).toBe(0);
    expect(warnTier({ tornadotag: "OBSERVED" })).toBe(1);
    expect(warnTier({ damagetag: "CONSIDERABLE" })).toBe(1);
    expect(warnTier({ max_damagetag: "DESTRUCTIVE" })).toBe(2);
    expect(warnTier({ is_pds: true })).toBe(2);
    expect(warnTier({ is_emergency: true })).toBe(3);
  });
  it("projects a track onto the national canvas", () => {
    const d = linePath({
      type: "LineString",
      coordinates: [
        [-97.5, 35.3],
        [-97.2, 35.4],
      ],
    });
    expect(d).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
    expect(linePath({ type: "LineString", coordinates: [[-97.5, 35.3]] })).toBe(
      "",
    );
  });
});
