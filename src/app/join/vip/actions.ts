"use server";

import { headers } from "next/headers";
import { getRealViewer } from "@/lib/auth/viewer";
import {
  cleanWxCode,
  VIP_CODE_DAYS,
  wxCodeOpen,
} from "@/lib/billing/academyVip";
import { getBilling } from "@/lib/billing/server";
import { checkoutUrl, stripeOn } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

async function origin() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "weather.sswx.space";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/**
 * Fix It List #36, 4: an Academy Lifetime VIP's two free months of VIP. No plan picking: the card goes on file at
 * Stripe's checkout, nothing is charged for two months, then VIP renews monthly unless they cancel. The code is spent
 * when the checkout completes (the Stripe webhook).
 */
export async function startVipMonths(
  raw: string,
): Promise<{ error: string } | { url: string }> {
  const code = cleanWxCode(raw);
  if (!code)
    return { error: "That code doesn't look right. It starts with WXVIP." };
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id)
    return { error: "Sign up or log in first." };
  if (!viewer.name) return { error: "Finish your profile first." };
  if (!stripeOn())
    return {
      error: "Card payments aren't connected yet. Please try again soon.",
    };
  if (!(await wxCodeOpen(code)))
    return {
      error: "That code was already used, or it isn't an Academy VIP code.",
    };
  const db = supabaseAdmin();
  const { data: had } = await db
    .from("subscriptions")
    .select("tier, status, stripe_customer, stripe_subscription")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (had?.status === "active" && had.stripe_subscription)
    return {
      error:
        "You already have a paid plan, so the free months can't be added to it. Your code still works for a new account.",
    };
  const vip = (await getBilling()).tiers.find((t) => t.id === "vip");
  if (!vip?.month)
    return { error: "VIP isn't open right now. Please try again soon." };
  const { error } = await db.rpc("save_plan", {
    p_user: viewer.id,
    p_tier: "vip",
    p_cycle: "month",
    p_pages: [],
    p_addons: [],
    p_regular: vip.month,
    p_first: [vip.month],
    p_promo: "academy-vip",
    p_coupon: null,
  });
  if (error) return { error: "Your free months couldn't start. Try again." };
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  try {
    const url = await checkoutUrl({
      user: viewer.id,
      email: user?.email ?? null,
      customer: had?.stripe_customer,
      name: `${vip.name} (2 free months, Academy Lifetime VIP)`,
      cycle: "month",
      regular: vip.month,
      first: [vip.month],
      origin: await origin(),
      trialDays: VIP_CODE_DAYS,
      meta: { wxvip: code },
    });
    return { url };
  } catch {
    return { error: "Card checkout couldn't start. Try again in a moment." };
  }
}
