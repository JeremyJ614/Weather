import { describe, expect, it } from "vitest";
import { DEFAULT_BILLING } from "@/lib/billing/plans";
import { revenue } from "@/lib/billing/revenue";

describe("revenue", () => {
  const vip = DEFAULT_BILLING.tiers.find((t) => t.id === "vip")!;
  it("counts only active billed plans as income", () => {
    const r = revenue(
      DEFAULT_BILLING,
      [
        {
          tier: "vip",
          cycle: "month",
          status: "active",
          comped: false,
          regular_cents: vip.month,
        },
        {
          tier: "vip",
          cycle: "year",
          status: "active",
          comped: false,
          regular_cents: 1200,
        },
        {
          tier: "vip",
          cycle: "month",
          status: "active",
          comped: true,
          regular_cents: 0,
        },
        {
          tier: "basic",
          cycle: "month",
          status: "awaiting_payment",
          comped: false,
          regular_cents: 500,
        },
      ],
      6,
    );
    expect(r.mrr).toBe(vip.month + 100);
    expect(r.paying).toBe(2);
    expect(r.comped).toBe(1);
    expect(r.forgone).toBe(vip.month);
    expect(r.waiting).toBe(1);
    expect(r.waitingValue).toBe(500);
    expect(r.slices[0].members).toBe(2);
  });
});
