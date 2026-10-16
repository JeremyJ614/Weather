import { describe, expect, it } from "vitest";
import { CAMS_OPEN, CAM_KINDS } from "@/lib/cams/style";
import { ALL_PAGES } from "@/lib/nav/registry";

describe("traffic cameras", () => {
  it("stay owner-only until the owner approves them", () => {
    expect(CAMS_OPEN).toBe(false);
    expect(ALL_PAGES.find((p) => p.slug === "traffic-cameras")?.adminOnly).toBe(
      true,
    );
  });
  it("have a color for every kind", () => {
    expect(CAM_KINDS.map((k) => k.key)).toEqual(["traffic", "weather", "fire"]);
  });
});
