import { cookies } from "next/headers";
import { getRealViewer } from "@/lib/auth/viewer";
import { getPass, savePass } from "@/lib/billing/perks";
import { PASS_COOKIE, signPass } from "@/lib/billing/pass";
import { DAY_PASS } from "@/lib/billing/plans";
import { getCheckoutSession } from "@/lib/billing/stripe";

/**
 * Back from paying for a Storm Day Pass (post-launch A4): confirms the payment with Stripe,
 * records the pass (if the webhook hasn't yet) and sets the signed 24-hour cookie the plan
 * locks honor. `?restore=1` re-issues the cookie on another device while a pass runs.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) =>
    Response.redirect(new URL(path, url.origin), 303);
  const viewer = await getRealViewer();
  if (!viewer.signedIn || !viewer.id) return to("/join");
  let pass = await getPass(viewer.id).catch(() => null);
  const id = url.searchParams.get("session");
  if (id && (!pass || pass.session !== id)) {
    const s = await getCheckoutSession(id).catch(() => null);
    if (
      !s ||
      s.payment_status !== "paid" ||
      s.client_reference_id !== viewer.id ||
      s.metadata?.kind !== "daypass"
    )
      return to("/join?canceled=1");
    pass = {
      until: Date.now() + DAY_PASS.hours * 3600_000,
      session: s.id,
      credit: s.amount_total ?? DAY_PASS.cents,
    };
    await savePass(viewer.id, pass).catch(() => null);
  }
  if (!pass || pass.until <= Date.now()) return to("/join");
  const value = await signPass(viewer.id, pass.until);
  if (value)
    (await cookies()).set(PASS_COOKIE, value, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(pass.until),
    });
  return to("/join?pass=1");
}
