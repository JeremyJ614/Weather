import { describe, expect, it } from "vitest";
import {
  DEFAULT_BILLING,
  cheapestTier,
  planOpens,
  type MemberPlan,
} from "@/lib/billing/plans";
import { SELLABLE_SLUGS } from "@/lib/billing/sellable";

const b = DEFAULT_BILLING;
const plan = (p: Partial<NonNullable<MemberPlan>>): MemberPlan => ({
  tier: "free",
  status: "active",
  comped: false,
  pages: [],
  addons: [],
  ...p,
});
const opens = (m: MemberPlan, slug: string) =>
  planOpens(b, m, slug, SELLABLE_SLUGS);

describe("plan locks", () => {
  it("keeps never-sold pages open to everyone", () => {
    expect(opens(null, "profile")).toBe(true);
    expect(opens(null, "notifications")).toBe(true);
  });
  it("treats no plan, or an unpaid one, as Free", () => {
    expect(opens(null, "dashboard")).toBe(true);
    expect(opens(null, "daily-brief")).toBe(false);
    expect(
      opens(plan({ tier: "vip", status: "awaiting_payment" }), "daily-brief"),
    ).toBe(false);
  });
  it("opens a paid or comped tier's pages and add-ons", () => {
    expect(opens(plan({ tier: "basic" }), "daily-brief")).toBe(true);
    expect(opens(plan({ tier: "basic" }), "tropical-outlook")).toBe(false);
    expect(
      opens(
        plan({ tier: "basic", addons: ["tropical-outlook"] }),
        "tropical-outlook",
      ),
    ).toBe(true);
    expect(
      opens(plan({ tier: "vip", status: "free", comped: true }), "climatology"),
    ).toBe(true);
  });
  it("names the cheapest tier with a page", () => {
    expect(cheapestTier(b, "daily-brief", SELLABLE_SLUGS)?.id).toBe("basic");
    expect(cheapestTier(b, "dashboard", SELLABLE_SLUGS)?.id).toBe("free");
  });
});
