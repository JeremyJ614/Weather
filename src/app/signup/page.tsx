import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { SignupStart } from "./SignupStart";
import { cleanWxCode, wxCodeOpen } from "@/lib/billing/academyVip";
import { getBilling } from "@/lib/billing/server";
import { VipOffer } from "../join/vip/VipOffer";

export const metadata: Metadata = pageMeta(
  "/signup",
  "Sign up",
  "Create a free StormSync Weather account: live radar, SPC outlooks, alerts and storm chasing tools.",
  { noindex: true },
);

/** Step one of signup: verify an email (link or Google), then the question-by-question form. */
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; vip?: string }>;
}) {
  const sp = await searchParams;
  // Fix It List #36, 4: an Academy Lifetime VIP's code skips Plans and Pricing and goes straight to the free months.
  const vip = cleanWxCode(sp.vip);
  const raw = vip ? `/join/vip?code=${vip}` : sp.next;
  const next = raw?.startsWith("/join") ? safeNext(raw) : "/join";
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(vip ? next : `/welcome?next=${encodeURIComponent(next)}`);
  const offer = vip ? await Promise.all([wxCodeOpen(vip), getBilling()]) : null;
  return (
    <>
      {vip && offer && (
        <VipOffer
          code={vip}
          open={offer[0]}
          price={offer[1].tiers.find((t) => t.id === "vip")?.month ?? null}
          gate={{ login: `/login?next=${encodeURIComponent(next)}` }}
        />
      )}
      <SignupStart next={`/welcome?next=${encodeURIComponent(next)}`} />
    </>
  );
}
