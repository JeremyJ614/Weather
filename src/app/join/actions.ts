"use server";

import { getRealViewer } from "@/lib/auth/viewer";
import {
  activePromos,
  couponOff,
  quote,
  type Choice,
  type TierId,
} from "@/lib/billing/plans";
import {
  SELLABLE_SLUGS,
  getBilling,
  getClaims,
  today,
} from "@/lib/billing/server";
import { checkoutUrl, portalUrl, stripeOn } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type PlanResult =
  | { error: string }
  | { status: "checkout"; url: string }
  | {
      status: "free" | "awaiting_payment";
      first: number;
      regular: number;
      promo: string | null;
    };

const TIERS = new Set(["free", "basic", "chasers", "advanced", "vip"]);

/** Checks a code for the plan being built (never reveals other codes). */
export async function checkCoupon(code: string, tier: string) {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,24}$/.test(c)) return null;
  const sb = await supabaseServer();
  const { data } = await sb.rpc("coupon_check", { p_code: c, p_tier: tier });
  const row = (data as { kind: string; amount: number }[] | null)?.[0];
  return row ? { code: c, kind: row.kind, amount: row.amount } : null;
}

/**
 * Saves the signed-in member's plan. Priced here, on the server, from the owner's
 * pricing, today's promotions and a checked coupon; the browser's numbers are ignored.
 * With card payments connected a paid plan goes straight to Stripe Checkout; without them
 * it is saved as awaiting payment and nothing is charged.
 */
export async function savePlan(
  raw: Choice,
  coupon: string,
): Promise<PlanResult> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  if (!viewer.name) return { error: "Finish your profile first." };
  const sellable = SELLABLE_SLUGS;
  const pick = (x: unknown) =>
    Array.isArray(x)
      ? [
          ...new Set(
            x.filter(
              (s): s is string => typeof s === "string" && sellable.includes(s),
            ),
          ),
        ].slice(0, 80)
      : [];
  if (
    !raw ||
    !TIERS.has(raw.tier) ||
    (raw.cycle !== "month" && raw.cycle !== "year")
  )
    return { error: "Pick a plan." };
  const choice: Choice = {
    tier: raw.tier,
    cycle: raw.cycle,
    pages: [],
    addons: pick(raw.addons),
  };
  const db = supabaseAdmin();
  const { data: had } = await db
    .from("subscriptions")
    .select("status, stripe_customer, stripe_subscription")
    .eq("user_id", viewer.id)
    .maybeSingle();
  // A second checkout would start a second subscription; changes go through billing.
  if (had?.status === "active" && had.stripe_subscription)
    return {
      error:
        "You already have a paid plan. Use Manage billing to change or cancel it first.",
    };
  const [billing, claims] = await Promise.all([getBilling(), getClaims()]);
  const q = quote(
    billing,
    choice,
    sellable,
    activePromos(billing, claims, today(), choice),
  );
  const c =
    coupon && q.regular > 0 ? await checkCoupon(coupon, choice.tier) : null;
  if (coupon && q.regular > 0 && !c)
    return { error: "That code isn't valid for this plan." };
  const first = [couponOff(q.first[0], c), ...q.first.slice(1)];
  const { error } = await db.rpc("save_plan", {
    p_user: viewer.id,
    p_tier: choice.tier as TierId,
    p_cycle: choice.cycle,
    p_pages: choice.pages,
    p_addons: choice.addons,
    p_regular: q.regular,
    p_first: first,
    p_promo: q.promo?.id ?? null,
    p_coupon: c?.code ?? null,
  });
  if (error) return { error: "Your plan couldn't be saved. Try again." };
  if (q.regular > 0 && stripeOn()) {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    try {
      const url = await checkoutUrl({
        user: viewer.id,
        email: user?.email,
        customer: had?.stripe_customer,
        name: `${billing.tiers.find((t) => t.id === choice.tier)?.name ?? "Plan"}${choice.addons.length ? ` + ${choice.addons.length} add-on${choice.addons.length === 1 ? "" : "s"}` : ""}`,
        cycle: choice.cycle,
        regular: q.regular,
        first,
        origin: await origin(),
      });
      return { status: "checkout", url };
    } catch {
      return {
        error:
          "Your plan is saved, but card checkout couldn't start. Try again in a moment.",
      };
    }
  }
  return {
    status: q.regular === 0 ? "free" : "awaiting_payment",
    first: first[0],
    regular: q.regular,
    promo: q.promo?.name ?? null,
  };
}

async function origin() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "weather.sswx.space";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/** Opens Stripe's billing portal for the signed-in member's paid plan. */
export async function manageBilling(): Promise<{
  url?: string;
  error?: string;
}> {
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return { error: "Sign in first." };
  if (!stripeOn()) return { error: "Card payments aren't connected yet." };
  const { data } = await (
    await supabaseServer()
  )
    .from("subscriptions")
    .select("stripe_customer")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!data?.stripe_customer)
    return { error: "There's no paid plan on this account yet." };
  try {
    return { url: await portalUrl(data.stripe_customer, await origin()) };
  } catch {
    return { error: "Billing couldn't open. Try again in a moment." };
  }
}
