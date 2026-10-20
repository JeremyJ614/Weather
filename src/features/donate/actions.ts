"use server";

import { headers } from "next/headers";
import { checkDonation } from "@/lib/billing/donate";
import { donationCheckoutUrl, stripeOn } from "@/lib/billing/stripe";
import { getRealViewer } from "@/lib/auth/viewer";
import { supabaseServer } from "@/lib/supabase/server";

export type GiveState = { error?: string; url?: string } | null;

/** Starts a Stripe Checkout for a gift; the page sends the browser there. */
export async function startDonation(
  _: GiveState,
  fd: FormData,
): Promise<GiveState> {
  const gift = checkDonation((k) => String(fd.get(k) ?? ""));
  if ("error" in gift) return gift;
  if (!stripeOn())
    return {
      error: "Card payments aren't switched on yet. Please check back soon.",
    };
  const viewer = await getRealViewer();
  const claims = viewer.signedIn
    ? (await (await supabaseServer()).auth.getClaims()).data?.claims
    : null;
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "weather.sswx.space";
  try {
    const url = await donationCheckoutUrl({
      ...gift,
      user: viewer.signedIn ? viewer.id : null,
      email: typeof claims?.email === "string" ? claims.email : null,
      origin: `${h.get("x-forwarded-proto") ?? "https"}://${host}`,
    });
    return { url };
  } catch {
    return { error: "Checkout couldn't start. Try again in a moment." };
  }
}
