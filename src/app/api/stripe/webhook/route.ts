import { sendReceipt } from "@/lib/billing/receipt";
import { recordDonation } from "@/lib/billing/donations";
import { planStatus, verifySignature } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Event = {
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Stripe → our plans. Checkout completing makes the member's plan active; subscription
 * changes and cancellations follow it; every paid invoice sends our receipt. Only signed
 * events are read (STRIPE_WEBHOOK_SECRET).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("stripe-signature"), secret))
    return new Response("Bad signature", { status: 400 });
  const ev = JSON.parse(raw) as Event;
  const o = ev.data.object;
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const meta = (o.metadata ?? {}) as Record<string, string | undefined>;
  if (ev.type === "checkout.session.completed" && meta.kind === "donation") {
    // A gift, not a plan: recorded and thanked, never touching subscriptions.
    if (
      o.payment_status === "paid" ||
      o.payment_status === "no_payment_required"
    )
      await recordDonation({
        ref: String(o.id ?? ""),
        cents: Number(o.amount_total ?? 0),
        monthly: o.mode === "subscription",
        meta,
        email:
          (o.customer_details as { email?: string } | undefined)?.email ??
          (typeof o.customer_email === "string" ? o.customer_email : null),
        first: true,
      }).catch(() => null);
  } else if (ev.type === "checkout.session.completed") {
    const user = String(
      o.client_reference_id ??
        (o.metadata as { user_id?: string } | undefined)?.user_id ??
        "",
    );
    if (/^[0-9a-f-]{36}$/.test(user) && typeof o.subscription === "string")
      await db
        .from("subscriptions")
        .update({
          status: "active",
          stripe_customer: typeof o.customer === "string" ? o.customer : null,
          stripe_subscription: o.subscription,
          updated_at: now,
        })
        .eq("user_id", user);
  } else if (
    ev.type === "customer.subscription.updated" ||
    ev.type === "customer.subscription.deleted"
  ) {
    const status =
      ev.type === "customer.subscription.deleted"
        ? "canceled"
        : planStatus(String(o.status));
    await db
      .from("subscriptions")
      .update({ status, updated_at: now })
      .eq("stripe_subscription", String(o.id));
  } else if (ev.type === "invoice.paid") {
    const sub =
      (
        o.parent as
          | { subscription_details?: { metadata?: Record<string, string> } }
          | undefined
      )?.subscription_details?.metadata ??
      (
        o.subscription_details as
          { metadata?: Record<string, string> } | undefined
      )?.metadata;
    if (sub?.kind === "donation") {
      // A monthly gift renewing (its first month is recorded at checkout).
      if (o.billing_reason === "subscription_cycle")
        await recordDonation({
          ref: String(o.id ?? ""),
          cents: Number(o.amount_paid ?? 0),
          monthly: true,
          meta: sub,
          email: typeof o.customer_email === "string" ? o.customer_email : null,
          first: false,
        }).catch(() => null);
    }
    // A failed email must not make Stripe retry the whole event.
    else await sendReceipt(o).catch(() => null);
  }
  return Response.json({ received: true });
}
