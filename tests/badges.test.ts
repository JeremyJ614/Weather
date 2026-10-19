import { describe, expect, it } from "vitest";
import { BADGE_ICONS } from "@/components/badge-icon-set";
import { BADGE_ICON_NAMES } from "@/lib/badge-icons";

describe("badge icons", () => {
  it("draws every icon an admin can pick", () => {
    expect(Object.keys(BADGE_ICONS).sort()).toEqual(
      [...BADGE_ICON_NAMES].sort(),
    );
  });
});
