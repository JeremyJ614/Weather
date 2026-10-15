import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { eroSpan } from "@/lib/flood/data";

describe("flood outlook", () => {
  it("turns ERO valid times into a Central-time span", () => {
    expect(eroSpan("2026-10-17 12:00:00", "2026-10-18 12:00:00")).toBe(
      "Sat 7 AM – Sun 7 AM CT",
    );
    expect(eroSpan(null, "x")).toBeNull();
  });
});
