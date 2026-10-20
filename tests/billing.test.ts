import { describe, expect, it } from "vitest";
import {
  activePromos,
  cleanBilling,
  DEFAULT_BILLING,
  quote,
  type Choice,
} from "@/lib/billing/plans";

const sellable = [
  "dashboard",
  "daily-brief",
  "sswxcon",
  "storm-chasing-outlook",
  "chasing-log",
  "extras",
  "tropical-outlook",
];
const S = new Set(sellable);
const c = (x: Partial<Choice>): Choice => ({
  tier: "basic",
  cycle: "month",
  pages: [],
  addons: [],
  ...x,
});

describe("billing", () => {
  it("prices tiers, add-ons and custom plans in cents", () => {
    expect(quote(DEFAULT_BILLING, c({}), sellable).regular).toBe(149);
    expect(quote(DEFAULT_BILLING, c({ cycle: "year" }), sellable).regular).toBe(
      1399,
    );
    // Add-ons: $0.50 each, specials 0.75 / 1.00; pages already in the tier aren't charged.
    expect(
      quote(
        DEFAULT_BILLING,
        c({ addons: ["sswxcon", "chasing-log", "daily-brief"] }),
        sellable,
      ).addons,
    ).toBe(150);
    expect(
      quote(
        DEFAULT_BILLING,
        c({ tier: "custom", pages: ["dashboard", "extras"] }),
        sellable,
      ).regular,
    ).toBe(125);
    expect(
      quote(
        DEFAULT_BILLING,
        c({ tier: "custom", cycle: "year", pages: ["dashboard"] }),
        sellable,
      ).regular,
    ).toBe(500);
    expect(quote(DEFAULT_BILLING, c({ tier: "free" }), sellable).regular).toBe(
      0,
    );
  });
  it("applies the launch promotion until its spots are gone, then the next one", () => {
    const today = "2026-10-14";
    const p1 = activePromos(DEFAULT_BILLING, {}, today);
    expect(p1.map((p) => p.id)).toEqual(["launch15"]);
    expect(p1[0].left).toBe(15);
    expect(
      quote(DEFAULT_BILLING, c({ tier: "vip" }), sellable, p1).first,
    ).toEqual([0, 250]);
    const p2 = activePromos(
      DEFAULT_BILLING,
      { launch15: 15, launch25: 3 },
      today,
    );
    expect(p2.map((p) => [p.id, p.left])).toEqual([["launch25", 7]]);
    expect(
      activePromos(DEFAULT_BILLING, { launch15: 15, launch25: 10 }, today),
    ).toEqual([]);
    // A free plan never shows a promotion.
    expect(
      quote(DEFAULT_BILLING, c({ tier: "free" }), sellable, p1).promo,
    ).toBeNull();
  });
  it("keeps saved edits only when valid", () => {
    const b = cleanBilling(
      {
        tiers: [
          { id: "basic", month: 199, year: -5, pages: ["dashboard", "nope"] },
          { id: "free", month: 999 },
        ],
        addons: { each: 60, special: { extras: 90, nope: 1 } },
        promos: [
          {
            id: "kickoff",
            on: true,
            months: [30, 200, 20],
            from: "2027-03-01",
          },
        ],
      },
      S,
    );
    const basic = b.tiers.find((t) => t.id === "basic")!;
    expect([basic.month, basic.year, basic.pages]).toEqual([
      199,
      1399,
      ["dashboard"],
    ]);
    expect(b.tiers.find((t) => t.id === "free")!.month).toBe(0);
    expect(b.addons).toEqual({
      each: 60,
      special: { "storm-chasing-outlook": 75, extras: 90, "chasing-log": 100 },
    });
    const k = b.promos.find((p) => p.id === "kickoff")!;
    expect([k.on, k.months, k.from]).toEqual([true, [30, 20], "2027-03-01"]);
    expect(
      activePromos(b, {}, "2026-10-14").some((p) => p.id === "kickoff"),
    ).toBe(false);
  });
});

import { SELLABLE_SLUGS } from "@/lib/billing/sellable";
import { ALWAYS as ALWAYS_OPEN } from "@/lib/billing/plans";

describe("pages every plan includes", () => {
  it("never sells the basics as add-ons", () => {
    for (const slug of [
      "",
      "join",
      "faq",
      "contact",
      "login",
      "profile",
      "settings",
      "notifications",
      "news",
      "disaster-response",
      "donate",
    ])
      expect(SELLABLE_SLUGS).not.toContain(slug);
    expect([...ALWAYS_OPEN].every((s) => !SELLABLE_SLUGS.includes(s))).toBe(
      true,
    );
  });
});
