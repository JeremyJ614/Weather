"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verifySolution } from "@/lib/auth/captcha";
import { normEmail } from "@/lib/auth/pin";
import { safeNext } from "@/lib/safe-next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export type StartState = { error?: string } | null;

// Per-instance brake on bursts from one address, on top of the human check.
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

/**
 * Step one of signup, no email confirmation: a human check, then the account is made and the
 * new member is signed in on the spot and sent to the signup questions (which set their PIN),
 * then on to Plans & Pricing. An email that already has an account is never signed in here.
 */
export async function startSignup(
  _: StartState,
  fd: FormData,
): Promise<StartState> {
  // Bots fill every field; people never see this one.
  if (String(fd.get("website") ?? "")) return { error: "Please try again." };
  const email = normEmail(String(fd.get("email") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254)
    return { error: "That email doesn't look right." };
  let human: unknown = null;
  try {
    human = JSON.parse(String(fd.get("human") ?? ""));
  } catch {}
  if (!verifySolution(human))
    return {
      error:
        "The human check didn't finish. Wait for the check mark, then try again.",
    };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
  if (tooMany(ip))
    return { error: "Too many signups from here. Try again in an hour." };

  const password = randomBytes(24).toString("base64url");
  let error: { message: string } | null = null;
  try {
    ({ error } = await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    }));
  } catch {
    error = { message: "unavailable" };
  }
  if (error)
    return /already|registered|exists/i.test(error.message)
      ? { error: "That email already has an account. Log in instead." }
      : { error: "Your account couldn't be made. Try again in a moment." };
  const sb = await supabaseServer();
  const { error: signInError } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError)
    return {
      error:
        "Your account is made, but signing in failed. Log in with an email link.",
    };
  // The form carries the welcome step's own address (the Google button shares it).
  const next = safeNext(String(fd.get("next") ?? "/join"));
  redirect(
    next.startsWith("/welcome")
      ? next
      : `/welcome?next=${encodeURIComponent(next)}`,
  );
}
