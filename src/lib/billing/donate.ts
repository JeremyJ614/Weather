/**
 * Donations (Fix-It List #16): one-time or monthly gifts of any amount to StormSync, paid by
 * Stripe Checkout. Amounts are whole cents throughout.
 */
export const PRESETS = [500, 1000, 2500, 5000, 10000];
export const MIN_CENTS = 100;
export const MAX_CENTS = 1_000_000;

export type DonationInput = {
  cents: number;
  monthly: boolean;
  name: string | null;
  message: string | null;
  wall: boolean;
};

const one = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

/** Dollars as typed ("25", "$25.50", "1,000") → cents; null when it isn't an amount. */
export function toCents(v: string): number | null {
  const t = v.replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export const dollars = (c: number) =>
  c % 100 === 0
    ? `$${(c / 100).toLocaleString("en-US")}`
    : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Checks a donation form; every message says what to fix. */
export function checkDonation(
  get: (k: string) => string,
): DonationInput | { error: string } {
  const preset = Number(get("preset"));
  const cents = PRESETS.includes(preset) ? preset : toCents(get("amount"));
  if (cents === null) return { error: "Enter an amount, like 15 or 15.50." };
  if (cents < MIN_CENTS) return { error: "The smallest gift is $1." };
  if (cents > MAX_CENTS)
    return { error: "For gifts over $10,000, please contact us." };
  const wall = get("wall") === "on";
  const name = one(get("name"), 60) || null;
  const message = one(get("message"), 200) || null;
  if (wall && !name)
    return { error: "Add the name to show on the supporters wall." };
  return { cents, monthly: get("monthly") === "on", name, message, wall };
}
