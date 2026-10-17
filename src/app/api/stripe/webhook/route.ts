import { planStatus, verifySignature } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Event = {
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Stripe → our plans. Checkout completing makes the member's plan active; subscription
 * changes and cancellations follow it. Only signed events are read (STRIPE_WEBHOOK_SECRET).
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
  if (ev.type === "checkout.session.completed") {
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
  }
  return Response.json({ received: true });
}
