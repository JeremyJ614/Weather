import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE } from "./invoice";
import { dollars } from "./donate";

type Meta = Record<string, string | undefined>;
const FROM = "StormSync Media <no-reply@send.sswx.space>";

/**
 * Records a gift from a Stripe event (the Checkout completing, or a monthly gift renewing)
 * and thanks the donor. Stripe can deliver an event twice: `stripe_ref` is unique, so the
 * second insert does nothing and no second email goes out.
 */
export async function recordDonation(g: {
  ref: string;
  cents: number;
  monthly: boolean;
  meta: Meta;
  email: string | null;
  first: boolean;
}) {
  if (!g.ref || g.cents < 100) return;
  const user = /^[0-9a-f-]{36}$/.test(g.meta.user_id ?? "")
    ? g.meta.user_id
    : null;
  const { data, error } = await supabaseAdmin()
    .from("donations")
    .upsert(
      {
        stripe_ref: g.ref.slice(0, 200),
        amount_cents: g.cents,
        monthly: g.monthly,
        name: g.meta.name?.slice(0, 60) || null,
        message: g.meta.message?.slice(0, 200) || null,
        on_wall: g.meta.wall === "1" && Boolean(g.meta.name),
        email: g.email?.slice(0, 200) ?? null,
        user_id: user,
      },
      { onConflict: "stripe_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (error || !data?.length || !g.first) return;
  const key = process.env.RESEND_API_KEY;
  if (!key || !g.email) return;
  const amount = dollars(g.cents);
  const hi = g.meta.name ? `Hi ${g.meta.name},` : "Hi,";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `donation-${g.ref}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: g.email,
      subject: `Thank you for your ${amount}${g.monthly ? " monthly" : ""} gift to StormSync`,
      text: [
        hi,
        "",
        `Thank you for your ${g.monthly ? `monthly gift of ${amount}` : `gift of ${amount}`} to StormSync Weather. It goes straight into keeping the radar, the forecasts and the alerts running, and into what we build next.`,
        "",
        g.monthly
          ? "Your gift renews each month. You can change or stop it any time from the link in Stripe's receipt."
          : "Stripe sends your payment receipt separately.",
        "",
        `${SITE}/donate`,
        "",
        "With thanks,",
        "StormSync Media",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
}
