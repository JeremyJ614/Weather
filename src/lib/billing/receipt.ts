import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OWNER_EMAIL } from "@/lib/help/alert";
import { getBilling } from "./server";
import { cleanInvoice, invoiceHtml, type InvoiceLine } from "./invoice";

type StripeInvoice = {
  id?: string;
  number?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  subscription?: string | null;
  parent?: {
    subscription_details?: { subscription?: string | null } | null;
  } | null;
  amount_paid?: number;
  hosted_invoice_url?: string | null;
  created?: number;
  status_transitions?: { paid_at?: number | null } | null;
  lines?: { data?: { description?: string | null; amount?: number }[] };
  total_discount_amounts?: { amount?: number }[] | null;
};

/**
 * Emails our receipt for a paid Stripe invoice (the first payment and every renewal).
 * The Stripe account also bills other StormSync apps, so only an invoice for one of our
 * members' subscriptions gets a receipt; nothing goes out for a $0 invoice either. Stripe
 * may deliver an event more than once, so the send carries the invoice id as Resend's
 * idempotency key: one invoice, one email.
 */
export async function sendReceipt(inv: StripeInvoice) {
  const key = process.env.RESEND_API_KEY;
  const to = inv.customer_email;
  const paid = inv.amount_paid ?? 0;
  if (!key || !to || !inv.id || paid <= 0) return { sent: false };
  const db = supabaseAdmin();
  const subId =
    inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  if (!subId) return { sent: false };
  const [{ data: tpl }, sub, billing] = await Promise.all([
    db
      .from("app_config")
      .select("value")
      .eq("key", "invoice_template")
      .maybeSingle(),
    db
      .from("subscriptions")
      .select("user_id, tier")
      .eq("stripe_subscription", subId)
      .maybeSingle(),
    getBilling(),
  ]);
  if (!sub.data?.user_id) return { sent: false };
  const { data: who } = await db
    .from("profiles")
    .select("first_name, nickname, use_nickname")
    .eq("id", sub.data.user_id)
    .maybeSingle();
  const name =
    (who?.use_nickname && who.nickname) ||
    who?.first_name ||
    inv.customer_name?.split(" ")[0] ||
    "there";
  const tier = sub.data?.tier as string | undefined;
  const plan =
    tier === "custom"
      ? "Build your own"
      : (billing.tiers.find((t) => t.id === tier)?.name ?? "StormSync");
  const lines: InvoiceLine[] = [
    ...(inv.lines?.data ?? []).map((l) => ({
      label: (l.description ?? "StormSync plan").slice(0, 120),
      cents: l.amount ?? 0,
    })),
    ...(inv.total_discount_amounts ?? [])
      .filter((d) => (d.amount ?? 0) > 0)
      .map((d) => ({ label: "Discount", cents: -(d.amount ?? 0) })),
  ];
  const at = (inv.status_transitions?.paid_at ?? inv.created ?? 0) * 1000;
  const { subject, html, text } = invoiceHtml(cleanInvoice(tpl?.value), {
    name,
    plan,
    number: inv.number ?? inv.id,
    date: new Date(at || Date.now()).toLocaleDateString("en-US", {
      dateStyle: "long",
      timeZone: "America/Chicago",
    }),
    lines,
    total: paid,
    url: inv.hosted_invoice_url,
  });
  const t = cleanInvoice(tpl?.value);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `receipt-${inv.id}`,
    },
    body: JSON.stringify({
      from: `${t.fromName} <billing@send.sswx.space>`,
      to,
      reply_to: OWNER_EMAIL,
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return { sent: res.ok };
}
