import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { form, planStatus, verifySignature } from "@/lib/billing/stripe";

const secret = "whsec_test";
const sign = (payload: string, t: number) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

describe("Stripe webhook signatures", () => {
  const body = '{"type":"checkout.session.completed"}';
  const now = Date.UTC(2026, 9, 17, 12);
  const t = now / 1000;
  it("accepts a fresh, correct signature", () => {
    expect(verifySignature(body, sign(body, t), secret, now)).toBe(true);
  });
  it("rejects a changed body, a wrong secret, an old timestamp or none", () => {
    expect(verifySignature(`${body} `, sign(body, t), secret, now)).toBe(false);
    expect(verifySignature(body, sign(body, t), "whsec_other", now)).toBe(
      false,
    );
    expect(verifySignature(body, sign(body, t - 600), secret, now)).toBe(false);
    expect(verifySignature(body, null, secret, now)).toBe(false);
  });
});

describe("Stripe requests", () => {
  it("encodes nested objects and arrays the way Stripe reads them", () => {
    const f = form({
      mode: "subscription",
      line_items: [{ quantity: 1, price_data: { unit_amount: 299 } }],
      skip: undefined,
    });
    expect(f.get("mode")).toBe("subscription");
    expect(f.get("line_items[0][quantity]")).toBe("1");
    expect(f.get("line_items[0][price_data][unit_amount]")).toBe("299");
    expect(f.has("skip")).toBe(false);
  });
  it("maps Stripe's subscription states to ours", () => {
    expect(planStatus("active")).toBe("active");
    expect(planStatus("trialing")).toBe("active");
    expect(planStatus("past_due")).toBe("awaiting_payment");
    expect(planStatus("canceled")).toBe("canceled");
  });
});
