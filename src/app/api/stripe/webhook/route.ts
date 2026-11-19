import { sendReceipt } from "@/lib/billing/receipt";
import { recordDonation } from "@/lib/billing/donations";
import { planStatus, verifySignature } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { claimFounder, markTrial, savePass } from "@/lib/billing/perks";
import { DAY_PASS, perkOn } from "@/lib/billing/plans";
import { getBilling, today } from "@/lib/billing/server";
import { send } from "@/lib/notify/deliver";
import { cleanWxCode, redeemWxCode } from "@/lib/billing/academyVip";

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
  } else if (
    ev.type === "checkout.session.completed" &&
    meta.kind === "daypass"
  ) {
    // Post-launch A4: 24 hours of everything from now (the return route may have set it first).
    const user = String(o.client_reference_id ?? meta.user_id ?? "");
    if (/^[0-9a-f-]{36}$/.test(user) && o.payment_status === "paid")
      await savePass(user, {
        until: Date.now() + DAY_PASS.hours * 3600_000,
        session: String(o.id ?? ""),
        credit: Number(o.amount_total ?? DAY_PASS.cents),
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
    if (/^[0-9a-f-]{36}$/.test(user) && meta.trial === "1")
      await markTrial(user).catch(() => null);
    // Fix It List #36, 4: the Academy VIP code is spent once its two free months have started.
    const wx = cleanWxCode(meta.wxvip);
    if (wx) await redeemWxCode(wx);
  } else if (ev.type === "customer.subscription.trial_will_end") {
    // Post-launch A4: a reminder before the trial turns into a charge (no surprises).
    const user = String(meta.user_id ?? "");
    const end = Number(o.trial_end ?? 0) * 1000;
    if (/^[0-9a-f-]{36}$/.test(user)) {
      const when = end
        ? new Date(end).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })
        : "soon";
      const title = "Your VIP trial ends " + (end ? when : "soon");
      const body =
        "Keep it and nothing changes. To stop, open Plans & Pricing → Manage billing before then.";
      await db
        .from("notifications")
        .insert({ user_id: user, level: "info", title, body });
      await send([
        {
          user_id: user,
          topic: "news",
          key: `trial-${String(o.id)}`,
          title,
          body,
          url: "/join",
        },
      ]).catch(() => null);
    }
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
    else {
      await sendReceipt(o).catch(() => null);
      // Post-launch A4: the first payments take the Founding Member spots.
      const user = sub?.user_id;
      if (
        user &&
        /^[0-9a-f-]{36}$/.test(user) &&
        Number(o.amount_paid ?? 0) > 0
      ) {
        const b = await getBilling().catch(() => null);
        const f = b?.promos.find((x) => x.kind === "founder");
        if (b && f && perkOn(b, "founder", today()))
          await claimFounder(user, f.firstN ?? 100).catch(() => null);
      }
    }
  }
  return Response.json({ received: true });
}
