/**
 * The receipt email (admin → Invoice email), sent after every paid Stripe invoice
 * (src/lib/billing/receipt.ts). Built from tables and inline styles so it holds together in
 * Gmail, Outlook and Apple Mail; dark like the app, with the color as text, rules and outline.
 */
export type InvoiceTemplate = {
  fromName: string;
  subject: string;
  heading: string;
  intro: string;
  footer: string;
  accent: string;
};
export const DEFAULT_INVOICE: InvoiceTemplate = {
  fromName: "StormSync Weather",
  subject: "Your StormSync receipt for {plan}",
  heading: "Payment received",
  intro: "Thanks for being a StormSync member, {name}. Here's your receipt.",
  footer:
    "Questions about a charge? Reply to this email or use the Contact page.",
  accent: "#d9b76f",
};
export const SITE = "https://weather.sswx.space";

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
    heading: str(o.heading, 60, DEFAULT_INVOICE.heading),
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
export const money = (c: number) =>
  `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toFixed(2)}`;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const BG = "#0b0c14";
const CARD = "#12131d";
const INK = "#e8e9f0";
const MUTED = "#8f92a8";
const RULE = "#262838";

/** Renders the receipt; `total` is what was charged (the lines' sum when left out). */
export function invoiceHtml(
  t: InvoiceTemplate,
  v: {
    name: string;
    plan: string;
    number: string;
    date: string;
    lines: InvoiceLine[];
    total?: number;
    /** Stripe's hosted invoice (with its PDF). */
    url?: string | null;
    /** Where images load from: the site, or the admin preview's own origin. */
    origin?: string;
  },
) {
  const vars = { name: v.name, plan: v.plan };
  const total = v.total ?? v.lines.reduce((a, l) => a + l.cents, 0);
  const site = v.origin ?? SITE;
  const a = t.accent;
  const cell = (s: string, extra = "") =>
    `<td style="padding:12px 0;border-bottom:1px solid ${RULE};font-size:14px;line-height:20px;${extra}">${s}</td>`;
  const rows = v.lines
    .map(
      (l) =>
        `<tr>${cell(esc(l.label), `color:${l.cents < 0 ? a : INK}`)}${cell(money(l.cents), `text-align:right;font-family:${MONO};color:${l.cents < 0 ? a : INK};white-space:nowrap`)}</tr>`,
    )
    .join("");
  const fact = (k: string, val: string) =>
    `<td valign="top" style="padding:0 8px 0 0;width:33%"><p style="margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">${k}</p><p style="margin:4px 0 0;font-size:14px;color:${INK};font-weight:600">${esc(val)}</p></td>`;
  const pre = `${t.fromName} receipt ${v.number}: ${money(total)} for ${v.plan}.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(fill(t.subject, vars))}</title></head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background:${BG}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;font-family:${FONT}">
<tr><td align="center" style="padding:0 0 18px"><a href="${site}" style="text-decoration:none"><img src="${site}/brand/logo-email.png" width="220" height="66" alt="StormSync Media" style="display:block;border:0;width:220px;height:auto"></a></td></tr>
<tr><td bgcolor="${CARD}" style="background:${CARD};border:1px solid ${a}55;border-top:4px solid ${a};border-radius:20px;padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:26px 26px 6px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border:2px solid ${a};border-radius:22px;color:${a};font-size:22px;font-weight:700;line-height:40px">&#10003;</td>
<td style="padding-left:14px"><p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${a}">${esc(t.fromName)} &middot; Receipt</p><p style="margin:4px 0 0;font-size:22px;line-height:28px;font-weight:800;color:${INK}">${esc(t.heading)}</p></td>
</tr></table>
</td></tr>
<tr><td style="padding:14px 26px 0"><p style="margin:0;font-size:15px;line-height:23px;color:#c9cbd6">${esc(fill(t.intro, vars))}</p></td></tr>
<tr><td style="padding:22px 26px 0"><p style="margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">Amount paid</p><p style="margin:4px 0 0;font-family:${MONO};font-size:34px;line-height:40px;font-weight:700;color:${a}">${money(total)}</p></td></tr>
<tr><td style="padding:20px 26px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${fact("Receipt", v.number)}${fact("Date", v.date)}${fact("Plan", v.plan)}</tr></table></td></tr>
<tr><td style="padding:22px 26px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 8px;border-bottom:1px solid ${RULE};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">Item</td><td style="padding:0 0 8px;border-bottom:1px solid ${RULE};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};text-align:right">Amount</td></tr>
${rows}
<tr><td style="padding:14px 0 0;font-size:15px;font-weight:700;color:${INK}">Total paid</td><td style="padding:14px 0 0;text-align:right;font-family:${MONO};font-size:18px;font-weight:700;color:${a};white-space:nowrap">${money(total)}</td></tr>
</table></td></tr>
${
  v.url
    ? `<tr><td align="center" style="padding:26px 26px 0"><a href="${esc(v.url)}" style="display:inline-block;padding:12px 22px;border:1.5px solid ${a};border-radius:999px;color:${a};font-size:14px;font-weight:700;text-decoration:none">View or download your invoice</a></td></tr>`
    : ""
}
<tr><td style="padding:26px 26px 26px"><p style="margin:0;padding-top:18px;border-top:1px dashed ${RULE};font-size:13px;line-height:20px;color:${MUTED}">${esc(fill(t.footer, vars))}</p>
<p style="margin:10px 0 0;font-size:13px;line-height:20px"><a href="${site}/settings" style="color:${a};text-decoration:underline">Manage your plan</a> <span style="color:${RULE}">&nbsp;|&nbsp;</span> <a href="${site}/faq?tab=plans-billing" style="color:${a};text-decoration:underline">Billing FAQ</a> <span style="color:${RULE}">&nbsp;|&nbsp;</span> <a href="${site}/contact?tab=support" style="color:${a};text-decoration:underline">Contact us</a></p></td></tr>
</table></td></tr>
<tr><td align="center" style="padding:20px 10px 0"><img src="${site}/brand/icon-email.png" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px;opacity:.85"><p style="margin:10px 0 0;font-size:11px;line-height:17px;color:#5d6075">StormSync Media &middot; <a href="${site}" style="color:#5d6075;text-decoration:underline">weather.sswx.space</a><br>Payments are processed securely by Stripe. We never see or store your card number.</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `${t.fromName} · ${t.heading}`,
    "",
    fill(t.intro, vars),
    "",
    `Receipt ${v.number} · ${v.date} · ${v.plan}`,
    ...v.lines.map((l) => `${l.label}: ${money(l.cents)}`),
    `Total paid: ${money(total)}`,
    ...(v.url ? ["", `Your invoice: ${v.url}`] : []),
    "",
    fill(t.footer, vars),
  ].join("\n");
  return { subject: fill(t.subject, vars), html, text };
}
