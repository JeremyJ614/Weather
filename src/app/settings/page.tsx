import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Settings2 } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getRealViewer, getViewer } from "@/lib/auth/viewer";
import { getBilling } from "@/lib/billing/server";
import { ALL_PAGES } from "@/lib/nav/registry";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { AccountPanels, type PlanSummary } from "./AccountPanels";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = pageMeta(
  "/settings",
  "Account Settings",
  "Your menus, theme and intro, your plan, your PIN, and your data.",
  { noindex: true },
);
export const dynamic = "force-dynamic";

/** Account Settings: menus, theme and intro, then plan, security, install and your data. */
export default async function Settings() {
  const [viewer, real, defaults] = await Promise.all([
    getViewer(),
    getRealViewer(),
    getSiteDefaults(),
  ]);
  // The account panels are the signed-in member's own (never shown while viewing as someone).
  let account: {
    email: string;
    pinSet: boolean;
    plan: PlanSummary;
  } | null = null;
  if (real.signedIn && !viewer.lens) {
    const sb = await supabaseServer();
    const [
      {
        data: { user },
      },
      billing,
    ] = await Promise.all([sb.auth.getUser(), getBilling()]);
    if (user?.email) {
      const [{ data: sub }, { data: prof }] = await Promise.all([
        sb
          .from("subscriptions")
          .select(
            "tier, cycle, status, comped, regular_cents, addons, stripe_customer",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        sb.from("profiles").select("pin_set").eq("id", user.id).maybeSingle(),
      ]);
      const label = (slug: string) =>
        ALL_PAGES.find((p) => p.slug === slug)?.label ?? slug;
      const tierName =
        sub?.tier === "custom"
          ? "Build your own"
          : (billing.tiers.find((t) => t.id === (sub?.tier ?? "free"))?.name ??
            "Free");
      account = {
        email: user.email,
        pinSet: Boolean(prof?.pin_set),
        plan: {
          tier: tierName,
          cycle: (sub?.cycle as "month" | "year" | undefined) ?? null,
          status: sub?.status ?? "free",
          comped: Boolean(sub?.comped),
          priceCents: sub?.regular_cents ?? 0,
          addons: ((sub?.addons ?? []) as string[]).map(label),
          billable: Boolean(sub?.stripe_customer),
        },
      };
    }
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Settings2 aria-hidden />}
        eyebrow={["Account"]}
        title="Account Settings"
        subtitle="Your menus, theme and intro, your plan, your PIN, and your data."
      />
      <div className="grid gap-4">
        <SettingsView
          signedIn={viewer.signedIn}
          defaults={{ menus: defaults.menus, theme: defaults.theme }}
        />
        {account && <AccountPanels {...account} />}
      </div>
    </main>
  );
}
