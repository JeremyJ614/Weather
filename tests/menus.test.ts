import { describe, expect, it } from "vitest";
import {
  DEFAULT_MENUS,
  MENU_STYLES,
  OFFERED,
  pickMenus,
} from "@/features/menus/styles";
import { resolvePlacements } from "@/lib/nav/spots";

describe("menu choice", () => {
  it("uses the owner's defaults", () => {
    expect(pickMenus({})).toEqual(DEFAULT_MENUS);
  });
  it("never uses the same menu for both", () => {
    const r = pickMenus({ main: "plates", second: "plates" });
    expect(r.main).toBe("plates");
    expect(r.second).not.toBe("plates");
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
  it("only allows offered styles in each menu", () => {
    expect(pickMenus({ main: "morph" }).main).toBe(DEFAULT_MENUS.main);
    expect(pickMenus({ second: "notch" }).second).toBe(DEFAULT_MENUS.second);
  });
  it("finds a clean or raised placement for every offered pair", () => {
    for (const a of OFFERED.main)
      for (const b of OFFERED.second) {
        if (a === b) continue;
        const r = resolvePlacements(
          MENU_STYLES[a].placements,
          MENU_STYLES[b].placements,
        );
        if (r.stacked)
          expect(r.second.id.endsWith("-raised"), `${a}+${b}`).toBe(true);
      }
  });
});
