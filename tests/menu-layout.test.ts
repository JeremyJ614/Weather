import { describe, expect, it } from "vitest";
import { applyLayout, cleanLayout, layoutFrom } from "@/lib/nav/layout";
import { ALL_PAGES, MAIN_NAV, SECOND_NAV } from "@/lib/nav/registry";

const known = new Set(ALL_PAGES.map((p) => p.slug));
const icons = new Set(["House", "Folder", "ShieldCheck"]);

describe("menu layout", () => {
  it("unchanged layout gives the built-in menus", () => {
    const l = layoutFrom(MAIN_NAV, SECOND_NAV);
    expect(applyLayout(MAIN_NAV, SECOND_NAV, l, "main")).toEqual(MAIN_NAV);
    expect(applyLayout(SECOND_NAV, MAIN_NAV, l, "second")).toEqual(SECOND_NAV);
  });
  it("moves, renames and hides pages, adds sections, keeps unplaced pages", () => {
    const l = cleanLayout(
      {
        main: [
          {
            id: "owner",
            label: "Owner tools",
            icon: "ShieldCheck",
            pages: ["admin", "dashboard", "admin", "nope"],
          },
          { id: "x", label: "", pages: ["daily-brief"] },
        ],
        second: [],
        pages: {
          dashboard: { label: "My Dash", hidden: false },
          admin: { icon: "Bogus" },
          "": { label: "x" },
        },
      },
      known,
      icons,
    )!;
    expect(l.main[0].pages).toEqual(["admin", "dashboard"]);
    expect(l.main).toHaveLength(1);
    const main = applyLayout(MAIN_NAV, SECOND_NAV, l, "main");
    expect(main[0].label).toBe("Owner tools");
    expect(main[0].pages.map((p) => p.label)).toEqual([
      "Admin Panel",
      "My Dash",
    ]);
    // Pages the layout never placed stay in their built-in sections.
    const slugs = main.flatMap((g) => g.pages.map((p) => p.slug));
    expect(slugs).toContain("daily-brief");
    expect(slugs.filter((s) => s === "dashboard")).toHaveLength(1);
    const hidden = cleanLayout(
      {
        main: [{ id: "a", label: "A", pages: ["dashboard"] }],
        pages: { dashboard: { hidden: true } },
      },
      known,
      icons,
    )!;
    expect(
      applyLayout(MAIN_NAV, SECOND_NAV, hidden, "main").flatMap((g) =>
        g.pages.map((p) => p.slug),
      ),
    ).not.toContain("dashboard");
  });
});
