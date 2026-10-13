import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  cleanLayout,
  move,
  toggle,
} from "@/features/dashboard/layout";

describe("dashboard layout", () => {
  it("moves among visible widgets and stops at the ends", () => {
    const l = toggle(DEFAULT_LAYOUT, "hourly");
    const m = move(l, "week", -1);
    expect(m.order.indexOf("week")).toBeLessThan(m.order.indexOf("now"));
    expect(move(DEFAULT_LAYOUT, "now", -1)).toBe(DEFAULT_LAYOUT);
  });
  it("cleans stored layouts and adds new widgets", () => {
    const l = cleanLayout({
      order: ["moon", "bogus", "moon"],
      hidden: ["x", "uv"],
    });
    expect(l.order[0]).toBe("moon");
    expect(l.order).toHaveLength(DEFAULT_LAYOUT.order.length);
    expect(l.hidden).toEqual(["uv"]);
    expect(cleanLayout("junk")).toEqual(DEFAULT_LAYOUT);
  });
});
