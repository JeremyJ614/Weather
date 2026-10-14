"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanBilling } from "@/lib/billing/plans";
import { BILLING_TAG, SELLABLE_SLUGS } from "@/lib/billing/server";

export type PriceState = { error?: string; ok?: string } | null;

/** Saves tier prices and pages, add-on prices and promotions (validated against the defaults). */
export async function saveBilling(json: string): Promise<PriceState> {
  const { supabase } = await requireAdmin("billing");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The pricing couldn't be read. Reload and try again." };
  }
  const value = cleanBilling(raw, new Set(SELLABLE_SLUGS));
  const { data, error } = await supabase
    .from("app_config")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", "billing")
    .select("key");
  if (error || !data?.length)
    return { error: "Pricing couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "set_pricing",
    p_target: "pricing",
    p_detail: {},
  });
  updateTag(BILLING_TAG);
  return { ok: "Saved. The signup page shows these prices now." };
}

const TIERS = ["free", "basic", "chasers", "advanced", "vip"];

export async function saveCoupon(
  _: PriceState,
  fd: FormData,
): Promise<PriceState> {
  const { supabase } = await requireAdmin("billing");
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const code = s("code").toUpperCase();
  const kind = s("kind") === "fixed" ? "fixed" : "percent";
  const amount =
    kind === "fixed"
      ? Math.round(Number(s("amount")) * 100)
      : Math.round(Number(s("amount")));
  const max = s("max") ? Math.round(Number(s("max"))) : null;
  if (!/^[A-Z0-9-]{3,24}$/.test(code))
    return { error: "Codes are 3–24 letters, numbers or dashes." };
  if (!(amount > 0) || (kind === "percent" && amount > 100))
    return {
      error:
        kind === "percent"
          ? "Enter 1–100 percent."
          : "Enter an amount in dollars.",
    };
  if (max !== null && !(max > 0))
    return { error: "Max uses must be a positive number." };
  const tiers = fd
    .getAll("tiers")
    .map(String)
    .filter((t) => TIERS.includes(t));
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s(k)) ? s(k) : null);
  const { error } = await supabase.from("coupons").upsert({
    code,
    kind,
    amount,
    tiers,
    starts: date("starts"),
    ends: date("ends"),
    max_uses: max,
    note: s("note").slice(0, 120) || null,
    active: true,
  });
  if (error) return { error: "The code couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "save_coupon",
    p_target: code,
    p_detail: { kind, amount },
  });
  revalidatePath("/admin/pricing");
  return { ok: `${code} saved.` };
}

export async function setCoupon(fd: FormData) {
  const { supabase } = await requireAdmin("billing");
  const code = String(fd.get("code") ?? "");
  const on = fd.get("on") === "1";
  await supabase.from("coupons").update({ active: on }).eq("code", code);
  await supabase.rpc("log_admin", {
    p_action: on ? "coupon_on" : "coupon_off",
    p_target: code,
  });
  revalidatePath("/admin/pricing");
}
