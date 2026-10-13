import { describe, expect, it } from "vitest";
import { DEFAULT_MENUS, MENU_STYLES, pickMenus } from "@/features/menus/styles";
import { resolvePlacements } from "@/lib/nav/spots";

describe("menu choice", () => {
  it("uses the owner's defaults", () => {
    expect(pickMenus({})).toEqual(DEFAULT_MENUS);
  });
  it("never uses the same menu for both", () => {
    const r = pickMenus({ main: "morph", second: "morph" });
    expect(r.main).toBe("morph");
    expect(r.second).not.toBe("morph");
  });
  it("ignores menus that no longer exist", () => {
    expect(pickMenus({ main: "gone", second: "also-gone" })).toEqual(
      DEFAULT_MENUS,
    );
  });
  it("places the default pair without overlap", () => {
    const r = resolvePlacements(
      MENU_STYLES.sweep.placements,
      MENU_STYLES.morph.placements,
    );
    expect(r.stacked).toBe(false);
  });
});
