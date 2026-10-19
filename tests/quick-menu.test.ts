import { describe, expect, it } from "vitest";
import { cleanQuick, quickGroups, QUICK_MAX } from "@/lib/nav/quick";
import { SECOND_NAV } from "@/lib/nav/registry";
import { cleanPrefs } from "@/lib/prefs";

const slugs = (g: ReturnType<typeof quickGroups>) =>
  g.flatMap((x) => x.pages.map((p) => p.slug));

describe("Quick Menu", () => {
  it("always leads with the storm chasing pages, then the pins in order", () => {
    const g = quickGroups(SECOND_NAV, ["radar-model-runs", "dashboard"], {
      isAdmin: false,
      locked: [],
    });
    expect(slugs(g)).toEqual([
      "storm-chasing-outlook",
      "tornado-archive",
      "chasing-log",
      "radar-model-runs",
      "dashboard",
    ]);
  });

  it("drops pages the plan doesn't open and admin pages for members", () => {
    const g = quickGroups(SECOND_NAV, ["traffic-cameras", "dashboard"], {
      isAdmin: false,
      locked: ["tornado-archive"],
    });
    expect(slugs(g)).toEqual([
      "storm-chasing-outlook",
      "chasing-log",
      "dashboard",
    ]);
  });

  it("keeps only real, pinnable, unique pages, at most eight", () => {
    expect(cleanQuick(["dashboard", "dashboard", "nope", "login", 3])).toEqual([
      "dashboard",
    ]);
    const many = [
      "dashboard",
      "daily-brief",
      "aqi-pollen",
      "mosquito-index",
      "wx-games",
      "leaderboard",
      "weekly-polls",
      "sswxcon",
      "astronomy",
    ];
    expect(cleanQuick(many)).toHaveLength(QUICK_MAX);
    expect(
      cleanPrefs({ quick: ["dashboard", "storm-chasing-outlook"] }),
    ).toEqual({ quick: ["dashboard"] });
  });
});
