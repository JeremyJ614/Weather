import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo/site";
import { getRealViewer } from "@/lib/auth/viewer";
import { cleanWxCode, wxCodeOpen } from "@/lib/billing/academyVip";
import { getBilling } from "@/lib/billing/server";
import { VipOffer } from "./VipOffer";

export const metadata: Metadata = pageMeta(
  "/join/vip",
  "Your free VIP months",
  "Two free months of VIP for StormSync Academy Lifetime VIPs.",
  { noindex: true },
);

/** Fix It List #36, 4: the Academy Lifetime VIP's two free months, skipping Plans and Pricing. */
export default async function VipMonths({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = cleanWxCode((await searchParams).code);
  if (!code) redirect("/join");
  const here = `/join/vip?code=${code}`;
  const viewer = await getRealViewer();
  if (!viewer.signedIn) redirect(`/signup?vip=${code}`);
  if (!viewer.name) redirect(`/welcome?next=${encodeURIComponent(here)}`);
  const [open, billing] = await Promise.all([wxCodeOpen(code), getBilling()]);
  const vip = billing.tiers.find((t) => t.id === "vip");
  return (
    <main className="min-h-dvh">
      <VipOffer code={code} price={vip?.month ?? null} open={open} />
    </main>
  );
}
