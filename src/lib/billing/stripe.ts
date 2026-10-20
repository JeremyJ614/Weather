import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Card payments are on once the owner adds STRIPE_SECRET_KEY (Vercel, server-only). */
export const stripeOn = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Stripe's form encoding: nested objects and arrays as a[b][0][c]. */
export function form(
  o: Record<string, unknown>,
  prefix = "",
  out = new URLSearchParams(),
) {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe<T>(path: string, body: Record<string, unknown>) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const j = (await r.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(j.error?.message ?? `Stripe ${r.status}`);
  return j as T;
}

/** A webhook's Stripe-Signature header: HMAC-SHA256 of "t.payload", within 5 minutes. */
export function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  return sigs.some(
    (s) =>
      s.length === want.length &&
      timingSafeEqual(Buffer.from(s), Buffer.from(want)),
  );
}

/** Stripe's subscription states, in ours. */
export function planStatus(stripeStatus: string) {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired")
    return "canceled";
  return "awaiting_payment";
}

/**
 * A subscription Checkout for a plan priced on our server. A lower first price (a launch
 * promotion or a code) becomes a single-use Stripe coupon for that many periods.
 */
export async function checkoutUrl(o: {
  user: string;
  email?: string | null;
  customer?: string | null;
  name: string;
  cycle: "month" | "year";
  regular: number;
  first: number[];
  origin: string;
}) {
  const firstPrice = o.first[0] ?? o.regular;
  const off = o.regular - firstPrice;
  const repeat =
    o.cycle === "month" &&
    o.first.length > 1 &&
    o.first.every((c) => c === firstPrice);
  const coupon =
    off > 0
      ? await stripe<{ id: string }>("coupons", {
          amount_off: off,
          currency: "usd",
          duration: repeat ? "repeating" : "once",
          ...(repeat ? { duration_in_months: o.first.length } : {}),
          max_redemptions: 1,
          name: "StormSync first-period price",
        })
      : null;
  const session = await stripe<{ url: string }>("checkout/sessions", {
    mode: "subscription",
    client_reference_id: o.user,
    ...(o.customer
      ? { customer: o.customer }
      : o.email
        ? { customer_email: o.email }
        : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: o.regular,
          recurring: { interval: o.cycle },
          product_data: { name: `StormSync Weather · ${o.name}` },
        },
      },
    ],
    ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
    metadata: { user_id: o.user },
    subscription_data: { metadata: { user_id: o.user } },
    success_url: `${o.origin}/join?paid=1`,
    cancel_url: `${o.origin}/join?canceled=1`,
  });
  return session.url;
}

/** Stripe's billing portal: update the card, see invoices, cancel. */
export async function portalUrl(customer: string, origin: string) {
  const s = await stripe<{ url: string }>("billing_portal/sessions", {
    customer,
    return_url: `${origin}/join`,
  });
  return s.url;
}

/** Cancels a subscription at once (a member deleting their account). */
export async function cancelSubscription(id: string) {
  const r = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  // Already canceled is fine: the point is that nothing bills again.
  if (!r.ok && r.status !== 404) throw new Error(`Stripe ${r.status}`);
}

/**
 * A donation Checkout: a one-time gift, or a monthly one (a subscription). Marked
 * `kind: donation` so the webhook records it as a gift and never as a plan.
 */
export async function donationCheckoutUrl(o: {
  cents: number;
  monthly: boolean;
  name: string | null;
  message: string | null;
  wall: boolean;
  user: string | null;
  email?: string | null;
  origin: string;
}) {
  const metadata = {
    kind: "donation",
    name: o.name ?? "",
    message: o.message ?? "",
    wall: o.wall ? "1" : "0",
    user_id: o.user ?? "",
  };
  const session = await stripe<{ url: string }>("checkout/sessions", {
    mode: o.monthly ? "subscription" : "payment",
    ...(o.monthly ? {} : { submit_type: "donate" }),
    ...(o.email ? { customer_email: o.email } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: o.cents,
          ...(o.monthly ? { recurring: { interval: "month" } } : {}),
          product_data: {
            name: o.monthly
              ? "Monthly gift to StormSync Weather"
              : "Gift to StormSync Weather",
          },
        },
      },
    ],
    metadata,
    ...(o.monthly
      ? { subscription_data: { metadata } }
      : {
          payment_intent_data: {
            metadata,
            description: "Donation to StormSync Weather",
          },
        }),
    success_url: `${o.origin}/donate?thanks=1`,
    cancel_url: `${o.origin}/donate`,
  });
  return session.url;
}
