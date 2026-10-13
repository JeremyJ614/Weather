import { describe, expect, it } from "vitest";
import {
  ALL_PAGES,
  MAIN_NAV,
  SECOND_NAV,
  visibleNav,
} from "@/lib/nav/registry";
import { BOTTOM_BAR, resolvePlacements } from "@/lib/nav/spots";

describe("navigation registry", () => {
  it("has unique slugs", () => {
    const slugs = ALL_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("leaves post-launch pages off the menus", () => {
    const labels = ALL_PAGES.map((p) => p.label.toLowerCase()).join("|");
    for (const word of [
      "raffle",
      "fairweather",
      "personal warnings",
      "store",
      "members suite",
    ])
      expect(labels).not.toContain(word);
  });

  it("hides admin-only pages from everyone else", () => {
    const pub = visibleNav(MAIN_NAV, false).flatMap((g) =>
      g.pages.map((p) => p.slug),
    );
    expect(pub).not.toContain("admin");
    expect(pub).not.toContain("traffic-cameras");
    const adm = visibleNav(MAIN_NAV, true).flatMap((g) =>
      g.pages.map((p) => p.slug),
    );
    expect(adm).toContain("admin");
  });

  it("keeps the second menu to the archive and the chasing log", () => {
    expect(SECOND_NAV.flatMap((g) => g.pages.map((p) => p.slug))).toEqual([
      "tornado-archive",
      "chasing-log",
    ]);
  });
});

describe("placement resolver", () => {
  const corner = [
    { id: "top-right", zones: ["top-right" as const] },
    { id: "top-left", zones: ["top-left" as const] },
  ];
  const fab = [
    { id: "bottom-right", zones: ["bottom-right" as const] },
    { id: "bottom-left", zones: ["bottom-left" as const] },
  ];
  const bar = [{ id: "bottom-bar", zones: BOTTOM_BAR }];

  it("keeps both first choices when they don't touch", () => {
    const r = resolvePlacements(corner, fab);
    expect([r.main.id, r.second.id, r.stacked]).toEqual([
      "top-right",
      "bottom-right",
      false,
    ]);
  });

  it("moves the second menu to its next free spot", () => {
    const r = resolvePlacements(corner, corner);
    expect(r.second.id).toBe("top-left");
  });

  it("lifts the second menu above a full-width bar when nothing is free", () => {
    const r = resolvePlacements(bar, fab);
    expect(r.second.id).toBe("bottom-right-raised");
    expect(r.stacked).toBe(true);
  });

  it("refuses a menu with no placements", () => {
    expect(() => resolvePlacements([], fab)).toThrow();
  });
});
