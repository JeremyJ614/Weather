import "server-only";
import { cleanBilling, type Billing } from "./plans";
import { SELLABLE_SLUGS } from "./sellable";

export { SELLABLE, SELLABLE_SLUGS } from "./sellable";
export const BILLING_TAG = "billing";

const cfg = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/** The owner's pricing (admin → Pricing) over the defaults. Cached; saving refreshes it. */
export async function getBilling(): Promise<Billing> {
  const { url, key } = cfg();
  const sellable = new Set(SELLABLE_SLUGS);
  if (!url || !key) return cleanBilling(null, sellable);
  try {
    const r = await fetch(
      `${url}/rest/v1/app_config?select=value&key=eq.billing`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: [BILLING_TAG] },
      },
    );
    const rows = r.ok ? ((await r.json()) as { value: unknown }[]) : [];
    return cleanBilling(rows[0]?.value, sellable);
  } catch {
    return cleanBilling(null, sellable);
  }
}

/** Promotion claims so far (for "spots left"); always fresh. */
export async function getClaims(): Promise<Record<string, number>> {
  const { url, key } = cfg();
  if (!url || !key) return {};
  try {
    const r = await fetch(`${url}/rest/v1/rpc/promo_claims`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    const rows = r.ok
      ? ((await r.json()) as { promo: string; claims: number }[])
      : [];
    return Object.fromEntries(rows.map((x) => [x.promo, Number(x.claims)]));
  } catch {
    return {};
  }
}

export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
