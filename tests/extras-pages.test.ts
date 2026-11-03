// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXTRAS_ITEMS,
  cleanItems,
  forTabs,
  isLive,
  onPages,
} from "@/lib/extras/items";
import { MAIN_NAV, SECOND_NAV } from "@/lib/nav/registry";
import { EXTRAS_GROUP, extrasGroup, isExtrasPage } from "@/lib/nav/extras";
import { pendingPages } from "@/lib/nav/pending";
import { applyLayout } from "@/lib/nav/layout";
import { SELLABLE_SLUGS, sellableNow } from "@/lib/billing/sellable";
import { ICON_NAMES } from "@/components/NavIcon";

describe("Extras items on pages of their own", () => {
  it("gives every item a unique address that no other page or route uses", () => {
    const slugs = EXTRAS_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const others = [...MAIN_NAV, ...SECOND_NAV].flatMap((g) =>
      g.pages.map((p) => p.slug),
    );
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9-]+$/);
      expect(others).not.toContain(s);
      expect(existsSync(join("src", "app", s))).toBe(false);
    }
  });

  it("keeps their addresses behind the proxy (sign-in and plan locks apply)", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    const matcher = new RegExp(
      `^${src.match(/"\/\(\(\?!(.+?)\)\.\*\)"/)![1].replace(/\\\\/g, "\\")}`,
    );
    for (const i of EXTRAS_ITEMS) expect(matcher.test(i.slug)).toBe(false);
  });

  it("uses icons the menus can draw", () => {
    for (const i of EXTRAS_ITEMS) expect(ICON_NAMES).toContain(i.icon);
  });

  it("keeps an item on its own page working but out of the Extras tabs", () => {
    const s = cleanItems({
      deer: "page",
      tor: "off",
      ink: "hidden",
      x: "page",
    });
    expect(s).toEqual({ deer: "page", tor: "off", ink: "hidden" });
    expect(isLive(s, "deer")).toBe(true);
    expect(isLive(s, "tor")).toBe(false);
    expect(isLive(s, "fish")).toBe(true);
    expect(forTabs(s)).toEqual({ deer: "hidden", tor: "off", ink: "hidden" });
    expect(onPages(s).map((i) => i.id)).toEqual(["deer"]);
  });

  it("lists only moved items in the menus and on the plans", () => {
    const s = cleanItems({ galaxy: "page", deer: "page" });
    expect(extrasGroup(s).pages.map((p) => p.slug)).toEqual([
      "deer-activity",
      "galaxy-forge",
    ]);
    const now = sellableNow(s).map((p) => p.slug);
    expect(now).toContain("deer-activity");
    expect(now).not.toContain("fishing-bite");
    expect(now).toContain("extras");
    // Locks know every slug, moved or not.
    for (const p of EXTRAS_GROUP.pages)
      expect(SELLABLE_SLUGS).toContain(p.slug);
  });

  it("puts moved items in the owner's menus, and drops them when they move back", () => {
    const layout = {
      main: [{ id: "home", label: "Home", icon: "House", pages: [""] }],
      second: [],
      pages: {},
    };
    const moved = [...MAIN_NAV, extrasGroup(cleanItems({ deer: "page" }))];
    const main = applyLayout(moved, SECOND_NAV, layout, "main");
    expect(main.at(-1)!.pages.map((p) => p.slug)).toEqual(["deer-activity"]);
    // Placed by the owner in a section, then moved back into Extras: gone.
    const placed = {
      ...layout,
      main: [{ ...layout.main[0], pages: ["", "deer-activity"] }],
    };
    const back = applyLayout(MAIN_NAV, SECOND_NAV, placed, "main");
    expect(back.flatMap((g) => g.pages).some((p) => isExtrasPage(p.slug))).toBe(
      false,
    );
  });

  it("never answers an Extras address with a phase notice", () => {
    expect(pendingPages().some((p) => isExtrasPage(p.slug))).toBe(false);
  });
});
