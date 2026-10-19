import type { Metadata } from "next";
import { getRealViewer } from "@/lib/auth/viewer";
import { activePromos, cheapestTier } from "@/lib/billing/plans";
import {
  SELLABLE,
  SELLABLE_SLUGS,
  getBilling,
  getClaims,
  today,
} from "@/lib/billing/server";
import { stripeOn } from "@/lib/billing/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { JoinView } from "./JoinView";

export const metadata: Metadata = {
  title: "Join · StormSync Weather",
  description: "Pick a plan, build your own, or start free.",
};

export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; paid?: string; canceled?: string }>;
}) {
  const sp = await searchParams;
  const lockedSlug = sp.locked;
  const [billing, claims, viewer] = await Promise.all([
    getBilling(),
    getClaims(),
    getRealViewer(),
  ]);
  let current = null;
  let billingOpen = false;
  if (viewer.signedIn && viewer.id) {
    const { data } = await (
      await supabaseServer()
    )
      .from("subscriptions")
      .select("tier, cycle, pages, addons, status, stripe_customer")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (data) {
      // Stripe's customer id stays on the server.
      const { stripe_customer, ...plan } = data;
      current = plan;
      billingOpen = stripeOn() && plan.status === "active" && !!stripe_customer;
    }
  }
  const lockedPage = SELLABLE.find((p) => p.slug === lockedSlug);
  return (
    <JoinView
      billing={billing}
      claims={claims}
      promos={activePromos(billing, claims, today())}
      today={today()}
      pages={SELLABLE.map(({ slug, label, icon, phase }) => ({
        slug,
        label,
        icon,
        phase,
      }))}
      signedIn={viewer.signedIn}
      hasProfile={Boolean(viewer.name)}
      current={current}
      notice={sp.paid ? "paid" : sp.canceled ? "canceled" : null}
      billingOpen={billingOpen}
      locked={
        lockedPage
          ? {
              label: lockedPage.label,
              tier:
                cheapestTier(billing, lockedPage.slug, SELLABLE_SLUGS)?.name ??
                null,
            }
          : null
      }
    />
  );
}
