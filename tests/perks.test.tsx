import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { passValid, signPass } from "@/lib/billing/pass";
import { activePromos, cleanBilling, perkOn } from "@/lib/billing/plans";

vi.mock("@/app/join/actions", () => ({
  askResponder: vi.fn(async () => ({})),
  buyDayPass: vi.fn(async () => ({})),
  startTrial: vi.fn(async () => ({})),
}));

describe("Storm Day Pass cookie", () => {
  it("accepts its own signature until it runs out", async () => {
    const until = 2_000_000;
    const v = await signPass("u1", until, "k");
    expect(await passValid(v!, "u1", until - 1, "k")).toBe(true);
    expect(await passValid(v!, "u1", until, "k")).toBe(false);
  });
  it("refuses another member, a tampered time or another key", async () => {
    const v = (await signPass("u1", 2_000_000, "k"))!;
    expect(await passValid(v, "u2", 1, "k")).toBe(false);
    expect(await passValid(v.replace("2000000", "9000000"), "u1", 1, "k")).toBe(
      false,
    );
    expect(await passValid(v, "u1", 1, "other")).toBe(false);
    expect(await signPass("u1", 1, "")).toBeNull();
  });
});

describe("post-launch offers", () => {
  it("start off, switch on from saved pricing, and never count as a plan's promotion", () => {
    const off = cleanBilling(null, new Set());
    expect(perkOn(off, "trial", "2026-11-15")).toBe(false);
    const on = cleanBilling(
      {
        promos: [
          { id: "trial", on: true },
          { id: "founder", on: true, firstN: 50 },
        ],
      },
      new Set(),
    );
    expect(perkOn(on, "trial", "2026-11-15")).toBe(true);
    expect(on.promos.find((p) => p.id === "founder")?.firstN).toBe(50);
    expect(activePromos(on, {}, "2026-11-15").some((p) => p.kind)).toBe(false);
  });

  it("show each switched-on offer on the Join page", async () => {
    const { Perks } = await import("@/app/join/Perks");
    render(
      <Perks
        d={{
          signedIn: true,
          founder: { left: 37, of: 100 },
          trial: { eligible: true, days: 7, price: 499 },
          dayPass: {
            price: 99,
            hours: 24,
            until: null,
            active: false,
            credit: 0,
          },
          responder: { pct: 30, status: "none" },
          justBought: false,
        }}
      />,
    );
    expect(screen.getByText("37 of 100 spots left")).toBeTruthy();
    expect(screen.getByText("Start my free trial")).toBeTruthy();
    expect(screen.getByText("Get a Day Pass · $0.99")).toBeTruthy();
    expect(screen.getByText("Ask for the discount")).toBeTruthy();
  });
});
