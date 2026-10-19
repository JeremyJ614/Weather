"use server";

import { redirect } from "next/navigation";
import { getRealViewer } from "@/lib/auth/viewer";
import { emailHash, pinPassword, validPin } from "@/lib/auth/pin";
import { verifyPin } from "@/lib/auth/verify-pin";
import { cancelSubscription, stripeOn } from "@/lib/billing/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type AccState = { error?: string; ok?: string } | null;

async function me() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { sb, user };
}

async function hasPin(id: string) {
  const { data } = await supabaseAdmin()
    .from("profiles")
    .select("pin_set")
    .eq("id", id)
    .maybeSingle();
  return Boolean(data?.pin_set);
}

/** Change (or first set) the 4-digit PIN; the current one is asked for when there is one. */
export async function changeMyPin(
  _: AccState,
  fd: FormData,
): Promise<AccState> {
  const { user } = await me();
  if (!user?.email) return { error: "Your sign-in expired. Sign in again." };
  const pin = String(fd.get("pin") ?? "");
  if (!validPin(pin) || pin !== String(fd.get("pin2") ?? ""))
    return { error: "Enter the same new 4-digit PIN twice." };
  if (await hasPin(user.id)) {
    const v = await verifyPin(user.email, String(fd.get("current") ?? ""));
    if (!v.ok) return { error: v.error };
  }
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: pinPassword(user.email, pin),
  });
  if (error) return { error: "Your PIN couldn't be saved. Try again." };
  await admin.from("profiles").update({ pin_set: true }).eq("id", user.id);
  await admin
    .from("pin_attempts")
    .delete()
    .eq("email_hash", emailHash(user.email));
  return { ok: "New PIN saved. Use it next time you sign in." };
}

/** Signs this account out on every phone and computer, this one included. */
export async function signOutEverywhere() {
  const { sb } = await me();
  await sb.auth.signOut({ scope: "global" });
  redirect("/login");
}

/** Everything the app keeps about the member, as rows the database lets them read. */
const MINE = [
  "subscriptions",
  "notify_prefs",
  "notify_sent",
  "brief_subscriptions",
  "game_guesses",
  "game_points",
  "trivia_answers",
  "poll_votes",
  "member_badges",
  "referral_adjust",
  "notification_reads",
  "chases",
] as const;

export async function exportMyData(): Promise<{
  json?: string;
  error?: string;
}> {
  const { sb, user } = await me();
  if (!user) return { error: "Sign in first." };
  const out: Record<string, unknown> = {
    exported: new Date().toISOString(),
    account: {
      email: user.email,
      created: user.created_at,
      lastSignIn: user.last_sign_in_at,
    },
  };
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  out.profile = profile ?? null;
  for (const t of MINE) {
    const { data } = await sb.from(t).select("*").eq("user_id", user.id);
    out[t] = data ?? [];
  }
  return { json: JSON.stringify(out, null, 2) };
}

/**
 * Deletes the member's account and everything tied to it, after their PIN (or, with no PIN,
 * their email typed out) and the word DELETE. A paid plan is canceled first so nothing bills
 * again. Admins and the owner can't delete themselves here.
 */
export async function deleteMyAccount(
  _: AccState,
  fd: FormData,
): Promise<AccState> {
  const viewer = await getRealViewer();
  const { sb, user } = await me();
  if (!user?.email || !viewer.signedIn)
    return { error: "Your sign-in expired. Sign in again." };
  if (viewer.isAdmin)
    return {
      error: "Admin and owner accounts can't be deleted here. Ask the owner.",
    };
  if (String(fd.get("confirm") ?? "").trim() !== "DELETE")
    return { error: "Type DELETE in capitals to confirm." };
  if (await hasPin(user.id)) {
    const v = await verifyPin(user.email, String(fd.get("pin") ?? ""));
    if (!v.ok) return { error: v.error };
  } else if (
    String(fd.get("email") ?? "")
      .trim()
      .toLowerCase() !== user.email.toLowerCase()
  )
    return { error: "Type your email address exactly to confirm." };

  const admin = supabaseAdmin();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.stripe_subscription && sub.status !== "canceled") {
    if (!stripeOn())
      return {
        error:
          "Your paid plan couldn't be canceled right now. Try again later.",
      };
    try {
      await cancelSubscription(sub.stripe_subscription);
    } catch {
      return {
        error:
          "Your paid plan couldn't be canceled, so nothing was deleted. Try again in a minute.",
      };
    }
  }
  // People they referred keep their accounts; only the link back goes.
  await admin
    .from("profiles")
    .update({ referred_by: null })
    .eq("referred_by", user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error)
    return {
      error: "The account couldn't be deleted. Try again or contact us.",
    };
  await sb.auth.signOut({ scope: "local" }).catch(() => null);
  redirect("/?deleted=1");
}
