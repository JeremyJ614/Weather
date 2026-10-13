import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { SELLABLE, getBilling, getClaims } from "@/lib/billing/server";
import { PricingEditor } from "./PricingEditor";
import { Coupons } from "./Coupons";

export const metadata: Metadata = {
  title: "Pricing · Admin · StormSync Media",
};

export default async function Pricing() {
  const { supabase } = await requireAdmin("billing");
  const [billing, claims, { data: coupons }, { data: plans }] =
    await Promise.all([
      getBilling(),
      getClaims(),
      supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("tier, status"),
    ]);
  const count = (f: (x: { tier: string; status: string }) => boolean) =>
    (plans ?? []).filter(f).length;
  return (
    <main className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-6 pb-28">
      <div>
        <h1 className="display text-3xl text-accent">Pricing &amp; plans</h1>
        <p className="mt-1 text-sm text-muted">
          Prices, the pages each plan opens, add-ons, promotions and codes.
          Changes show on the signup page right away. Card payments aren&apos;t
          connected yet, so paid choices are saved without charging anyone.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Plans chosen", count(() => true)],
          ["Free", count((x) => x.status === "free")],
          ["Awaiting payment", count((x) => x.status === "awaiting_payment")],
        ].map(([k, v]) => (
          <div
            key={k}
            className="grid gap-0.5 rounded-2xl border border-line bg-surface p-3 text-center"
          >
            <b className="mono text-xl text-accent">{v}</b>
            <span className="text-xs text-muted">{k}</span>
          </div>
        ))}
      </div>
      <PricingEditor
        initial={billing}
        claims={claims}
        pages={SELLABLE.map(({ slug, label }) => ({ slug, label }))}
      />
      <Coupons list={coupons ?? []} />
    </main>
  );
}
