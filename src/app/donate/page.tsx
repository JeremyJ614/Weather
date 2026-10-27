import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { supabaseServer } from "@/lib/supabase/server";
import { stripeOn } from "@/lib/billing/stripe";
import { DonateView, type Gift } from "@/features/donate/DonateView";

export const metadata: Metadata = pageMeta(
  "/donate",
  "Donate",
  "Support StormSync Weather with a one-time or monthly gift of any amount.",
);

/** Donations (Fix-It List #16): give any amount, once or monthly, through Stripe. */
export default async function Donate({
  searchParams,
}: {
  searchParams: Promise<{ thanks?: string }>;
}) {
  const [{ thanks }, sb] = await Promise.all([searchParams, supabaseServer()]);
  const [totals, wall] = await Promise.all([
    sb.rpc("donation_totals"),
    sb.rpc("donation_wall", { p_limit: 24 }),
  ]);
  const t = (
    totals.data as
      { total_cents: number; gifts: number; donors: number }[] | null
  )?.[0];
  return (
    <DonateView
      thanks={thanks === "1"}
      open={stripeOn()}
      totals={{
        cents: Number(t?.total_cents ?? 0),
        gifts: Number(t?.gifts ?? 0),
        donors: Number(t?.donors ?? 0),
      }}
      wall={(wall.data ?? []) as Gift[]}
    />
  );
}
