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
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type PlanResult =
  | { error: string }
  | {
      status: "free" | "awaiting_payment";
      first: number;
      regular: number;
      promo: string | null;
    };

const TIERS = new Set([
  "free",
  "basic",
  "chasers",
  "advanced",
  "vip",
  "custom",
]);

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
 * Paid plans wait for checkout (card payments aren't connected yet): nothing is charged.
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
    pages: raw.tier === "custom" ? pick(raw.pages) : [],
    addons: raw.tier === "custom" ? [] : pick(raw.addons),
  };
  if (choice.tier === "custom" && !choice.pages.length)
    return { error: "Pick at least one page for your own plan." };
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
  const { error } = await supabaseAdmin().rpc("save_plan", {
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
  return {
    status: q.regular === 0 ? "free" : "awaiting_payment",
    first: first[0],
    regular: q.regular,
    promo: q.promo?.name ?? null,
  };
}
