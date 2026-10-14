import { describe, expect, it } from "vitest";
import {
  cleanInvoice,
  DEFAULT_INVOICE,
  invoiceHtml,
} from "@/lib/billing/invoice";

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
