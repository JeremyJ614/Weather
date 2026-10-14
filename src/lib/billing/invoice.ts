/** The invoice email (admin → Invoice email). Real sends start with checkout (Phase 64). */
export type InvoiceTemplate = {
  fromName: string;
  subject: string;
  intro: string;
  footer: string;
  accent: string;
};
export const DEFAULT_INVOICE: InvoiceTemplate = {
  fromName: "StormSync Weather",
  subject: "Your StormSync receipt for {plan}",
  intro: "Thanks for being a StormSync member, {name}. Here's your receipt.",
  footer:
    "Questions about a charge? Reply to this email or use the Contact page.",
  accent: "#d9b76f",
};

const str = (v: unknown, n: number, d: string) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d;

export function cleanInvoice(v: unknown): InvoiceTemplate {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    fromName: str(o.fromName, 60, DEFAULT_INVOICE.fromName).replace(
      /[<>"]/g,
      "",
    ),
    subject: str(o.subject, 120, DEFAULT_INVOICE.subject),
    intro: str(o.intro, 600, DEFAULT_INVOICE.intro),
    footer: str(o.footer, 400, DEFAULT_INVOICE.footer),
    accent:
      typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent)
        ? o.accent
        : DEFAULT_INVOICE.accent,
  };
}

export type InvoiceLine = { label: string; cents: number };
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
const money = (c: number) =>
  `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;

/** Renders the invoice as email HTML (dark, matching the app). */
export function invoiceHtml(
  t: InvoiceTemplate,
  v: {
    name: string;
    plan: string;
    number: string;
    date: string;
    lines: InvoiceLine[];
  },
) {
  const vars = { name: v.name, plan: v.plan };
  const total = v.lines.reduce((a, l) => a + l.cents, 0);
  const rows = v.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;color:#c9cbd6">${esc(l.label)}</td><td style="padding:8px 0;text-align:right;font-family:monospace;color:${l.cents < 0 ? t.accent : "#e8e9f0"}">${money(l.cents)}</td></tr>`,
    )
    .join("");
  return {
    subject: fill(t.subject, vars),
    html: `<div style="background:#0b0c14;padding:28px 16px;font-family:system-ui,sans-serif"><div style="max-width:480px;margin:0 auto;border:1px solid ${t.accent}55;border-radius:20px;padding:24px;background:#12131d;color:#e8e9f0">
<p style="margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${t.accent}">${esc(t.fromName)} · Receipt ${esc(v.number)}</p>
<p style="margin:14px 0 0;font-size:15px;line-height:1.5">${esc(fill(t.intro, vars))}</p>
<p style="margin:10px 0 0;font-size:12px;color:#8f92a8">${esc(v.date)}</p>
<table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:12px 0 0;border-top:1px dashed #33364a;font-weight:700">Total</td><td style="padding:12px 0 0;border-top:1px dashed #33364a;text-align:right;font-family:monospace;font-size:18px;font-weight:700;color:${t.accent}">${money(total)}</td></tr></table>
<p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#8f92a8">${esc(fill(t.footer, vars))}</p>
</div></div>`,
  };
}
