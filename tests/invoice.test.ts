import { describe, expect, it } from "vitest";
import {
  cleanInvoice,
  DEFAULT_INVOICE,
  invoiceHtml,
  money,
} from "@/lib/billing/invoice";

const v = {
  name: "Jay",
  plan: "VIP",
  number: "INV-1",
  date: "October 19, 2026",
  lines: [
    { label: "VIP · monthly", cents: 499 },
    { label: "Discount", cents: -50 },
  ],
};

describe("invoice template", () => {
  it("falls back to defaults and rejects bad colors", () => {
    expect(cleanInvoice({ accent: "red", subject: "  " })).toEqual(
      DEFAULT_INVOICE,
    );
  });
  it("fills names, escapes text and totals the lines", () => {
    const t = cleanInvoice({
      intro: "Hi {name} <b>",
      subject: "Receipt: {plan}",
    });
    const r = invoiceHtml(t, {
      name: "Sam",
      plan: "VIP",
      number: "T-1",
      date: "Oct 14",
      lines: [
        { label: "VIP", cents: 1500 },
        { label: "Code SAVE", cents: -500 },
      ],
    });
    expect(r.subject).toBe("Receipt: VIP");
    expect(r.html).toContain("Hi Sam &#60;b&#62;");
    expect(r.html).toContain("$10.00");
  });
});

describe("receipt email", () => {
  it("fills the member's name and plan, and totals the lines", () => {
    const r = invoiceHtml(DEFAULT_INVOICE, v);
    expect(r.subject).toBe("Your StormSync receipt for VIP");
    expect(r.html).toContain("Thanks for being a StormSync member, Jay.");
    expect(r.html).toContain("$4.49");
    expect(r.text).toContain("Total paid: $4.49");
  });
  it("shows what Stripe charged when it's given", () => {
    const r = invoiceHtml(DEFAULT_INVOICE, { ...v, total: 524 });
    expect(r.html).toContain("$5.24");
  });
  it("escapes anything a member or admin typed", () => {
    const t = cleanInvoice({ intro: "Hi {name} <script>x</script>" });
    const r = invoiceHtml(t, { ...v, name: '<img src=x onerror="1">' });
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<img src=x");
  });
  it("links the invoice only when Stripe has one, with images from the site", () => {
    expect(invoiceHtml(DEFAULT_INVOICE, v).html).not.toContain(
      "View or download",
    );
    const r = invoiceHtml(DEFAULT_INVOICE, {
      ...v,
      url: "https://invoice.stripe.com/i/abc",
    });
    expect(r.html).toContain('href="https://invoice.stripe.com/i/abc"');
    expect(r.html).toContain("https://weather.sswx.space/brand/logo-email.png");
  });
  it("writes negative money with a real minus", () => {
    expect(money(-50)).toBe("−$0.50");
    expect(money(1999)).toBe("$19.99");
  });
});
