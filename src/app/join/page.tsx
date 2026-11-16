import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { getRealViewer } from "@/lib/auth/viewer";
import {
  activePromos,
  cheapestTier,
  DAY_PASS,
  perkOn,
  RESPONDER_PCT,
  TRIAL_DAYS,
  type Billing,
} from "@/lib/billing/plans";
import {
  getFounders,
  getPass,
  getResponders,
  getTrials,
} from "@/lib/billing/perks";
import { Perks, type PerksData } from "./Perks";
import {
  SELLABLE,
  SELLABLE_SLUGS,
  getBilling,
  getClaims,
  sellableNow,
  today,
} from "@/lib/billing/server";
import { getSiteDefaults } from "@/lib/settings";
import { stripeOn } from "@/lib/billing/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { JoinView } from "./JoinView";

export const metadata: Metadata = pageMeta(
  "/join",
  "Join",
  "Pick a plan, build your own, or start free.",
);

export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{
    locked?: string;
    paid?: string;
    canceled?: string;
    pass?: string;
  }>;
}) {
  const sp = await searchParams;
  const lockedSlug = sp.locked;
  const [billing, claims, viewer, { extras }] = await Promise.all([
    getBilling(),
    getClaims(),
    getRealViewer(),
    getSiteDefaults(),
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
  const perks = await perksFor(
    billing,
    viewer.id ?? null,
    current?.status ?? null,
  );
  perks.justBought = Boolean(sp.pass);
  return (
    <JoinView
      billing={billing}
      claims={claims}
      promos={activePromos(billing, claims, today())}
      today={today()}
      pages={sellableNow(extras).map(({ slug, label, icon, phase }) => ({
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
      perks={<Perks d={perks} />}
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

/** What each post-launch offer shows this viewer (only the ones switched on). */
async function perksFor(
  billing: Billing,
  user: string | null,
  status: string | null,
): Promise<PerksData> {
  const day = today();
  const on = (k: "founder" | "trial" | "daypass" | "responder") =>
    perkOn(billing, k, day);
  const [founders, trials, pass, responders] = await Promise.all([
    on("founder") ? getFounders().catch(() => ({ ids: [] as string[] })) : null,
    on("trial") && user
      ? getTrials().catch(() => ({ ids: [] as string[] }))
      : null,
    on("daypass") && user ? getPass(user).catch(() => null) : null,
    on("responder") && user
      ? getResponders().catch(() => ({ list: [] }))
      : null,
  ]);
  const of = billing.promos.find((p) => p.kind === "founder")?.firstN ?? 100;
  const vip = billing.tiers.find((t) => t.id === "vip");
  const mine = responders?.list.find((r) => r.user === user);
  return {
    signedIn: Boolean(user),
    founder: founders
      ? { left: Math.max(0, of - founders.ids.length), of }
      : null,
    trial:
      on("trial") && vip?.month
        ? {
            eligible:
              !user || (status !== "active" && !trials?.ids.includes(user)),
            days: TRIAL_DAYS,
            price: vip.month,
          }
        : null,
    dayPass: on("daypass")
      ? {
          price: DAY_PASS.cents,
          hours: DAY_PASS.hours,
          until: pass?.until ?? null,
          active: Boolean(pass && pass.until > Date.now()),
          credit:
            pass &&
            !pass.used &&
            pass.until < Date.now() &&
            Date.now() - pass.until < 7 * 864e5
              ? pass.credit
              : 0,
        }
      : null,
    responder: on("responder")
      ? { pct: RESPONDER_PCT, status: mine?.status ?? "none" }
      : null,
    justBought: false,
  };
}
