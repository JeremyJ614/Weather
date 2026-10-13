import type { Metadata } from "next";
import { getRealViewer } from "@/lib/auth/viewer";
import { activePromos } from "@/lib/billing/plans";
import { SELLABLE, getBilling, getClaims, today } from "@/lib/billing/server";
import { supabaseServer } from "@/lib/supabase/server";
import { JoinView } from "./JoinView";

export const metadata: Metadata = {
  title: "Join · StormSync Weather",
  description: "Pick a plan, build your own, or start free.",
};

export default async function Join() {
  const [billing, claims, viewer] = await Promise.all([
    getBilling(),
    getClaims(),
    getRealViewer(),
  ]);
  let current = null;
  if (viewer.signedIn && viewer.id) {
    const { data } = await (
      await supabaseServer()
    )
      .from("subscriptions")
      .select("tier, cycle, pages, addons, status")
      .eq("user_id", viewer.id)
      .maybeSingle();
    current = data;
  }
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
    />
  );
}
