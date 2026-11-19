import "server-only";

/**
 * Fix It List #36, 4: an Academy Lifetime VIP gets a single use code (WXVIP and four digits) worth two free months of
 * Weather Center VIP. The codes live in the Academy's database; this checks and spends them through its two public
 * functions. Both settings are server only env vars; without them no code is ever accepted.
 */
const URL = process.env.ACADEMY_SUPABASE_URL ?? "";
const KEY = process.env.ACADEMY_PUBLISHABLE_KEY ?? "";

/** Two months, rounded up, before the first charge. */
export const VIP_CODE_DAYS = 61;

/** A code as the member typed or linked it, or null when it can't be one. */
export function cleanWxCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").toUpperCase().replace(/\s+/g, "");
  return /^WXVIP\d{4}$/.test(v) ? v : null;
}

async function call(fn: "check_wx_code" | "redeem_wx_code", code: string) {
  if (!URL || !KEY) return false;
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: code }),
    cache: "no-store",
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

/** Is the code real and still unused? */
export async function wxCodeOpen(code: string) {
  return call("check_wx_code", code).catch(() => false);
}

/** Spend the code (once the member's checkout is done). False when it was already used. */
export async function redeemWxCode(code: string) {
  return call("redeem_wx_code", code).catch(() => false);
}
