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
      MENU_STYLES.peek.placements,
    );
    expect(r.stacked).toBe(false);
  });
  it("has every offered style built", () => {
    expect(OFFERED.main).toHaveLength(18);
    expect(OFFERED.second).toHaveLength(15);
    for (const id of [...OFFERED.main, ...OFFERED.second])
      expect(MENU_STYLES[id], id).toBeDefined();
  });
  it("only allows offered styles in each menu", () => {
    expect(pickMenus({ main: "peek" }).main).toBe(DEFAULT_MENUS.main);
    expect(pickMenus({ second: "notch" }).second).toBe(DEFAULT_MENUS.second);
  });
  it("drops the retired menus (owner's Final Fix-It #15–16, Fix Lists 2026-10-25 and 2026-10-26)", () => {
    for (const id of [
      "split",
      "notch",
      "depth",
      "curtain",
      "railpop",
      "morph",
      "radar",
      "bentolive",
      "fan",
    ]) {
      expect(OFFERED.main).not.toContain(id);
      expect(OFFERED.second).not.toContain(id);
      expect(MENU_STYLES[id]).toBeUndefined();
    }
    expect(OFFERED.second).not.toContain("scrolltabs");
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

describe("Hive honeycomb", async () => {
  const { combRows } = await import("@/features/menus/Hive");
  it("interlocks every row, as few rows as possible", () => {
    expect(combRows(7)).toEqual([2, 3, 2]);
    expect(combRows(8)).toEqual([3, 2, 3]);
    expect(combRows(9)).toEqual([1, 2, 3, 2, 1]);
    expect(combRows(10)).toEqual([3, 2, 3, 2]);
    for (let n = 1; n <= 14; n++) {
      const r = combRows(n);
      expect(r.reduce((a, b) => a + b, 0)).toBe(n);
      for (let i = 1; i < r.length; i++)
        expect(Math.abs(r[i] - r[i - 1])).toBe(1);
    }
  });
});
