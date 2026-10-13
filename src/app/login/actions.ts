"use server";

import { cookies, headers } from "next/headers";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { afterFailure, lockedUntil, type Attempts } from "@/lib/auth/lockout";
import { emailHash, normEmail, pinPassword, validPin } from "@/lib/auth/pin";
import { checkSignup, type SignupInput } from "@/lib/auth/signup";

export type FormState = { error?: string } | null;

/** Records the "Remember this device" choice before a sign-in writes the session cookies. */
async function rememberChoice(fd: FormData) {
  (await cookies()).set(
    REMEMBER_COOKIE,
    fd.get("remember") === "0" ? "0" : "1",
    {
      path: "/",
      sameSite: "lax",
      maxAge: 400 * 86400,
    },
  );
}

const lockMsg = (until: number) =>
  `Too many wrong PINs. Try again in ${Math.ceil((until - Date.now()) / 60000)} minutes, or use an email link.`;

async function pinSignIn(_: FormState, fd: FormData): Promise<FormState> {
  const email = normEmail(String(fd.get("email") ?? ""));
  const pin = String(fd.get("pin") ?? "");
  if (!email || !validPin(pin))
    return { error: "Enter your email and 4-digit PIN." };

  await rememberChoice(fd);
  const admin = supabaseAdmin();
  const hash = emailHash(email);
  const { data: row } = await admin
    .from("pin_attempts")
    .select("failures, locks, locked_until")
    .eq("email_hash", hash)
    .maybeSingle<Attempts>();
  const until = lockedUntil(row);
  if (until) return { error: lockMsg(until) };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pinPassword(email, pin),
  });
  if (error) {
    const next = afterFailure(row);
    await admin.from("pin_attempts").upsert({
      email_hash: hash,
      ...next,
      updated_at: new Date().toISOString(),
    });
    const locked = lockedUntil(next);
    return {
      error: locked ? lockMsg(locked) : "That email and PIN don't match.",
    };
  }
  if (row) await admin.from("pin_attempts").delete().eq("email_hash", hash);
  redirect(safeNext(String(fd.get("next") ?? "")));
}

function readSignup(fd: FormData): SignupInput {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    firstName: s("firstName"),
    lastName: s("lastName"),
    nickname: s("nickname"),
    useNickname: fd.get("useNickname") === "on",
    phone: s("phone").replace(/[\s().-]/g, ""),
    city: s("city"),
    state: s("state"),
    birthday: s("birthday"),
    foundUs: s("foundUs"),
    referral: s("referral"),
    pin: s("pin"),
    pin2: s("pin2"),
  };
}

async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your sign-in expired. Sign in again." };

  const f = readSignup(fd);
  const problem = checkSignup(f);
  if (problem) return { error: problem };

  const admin = supabaseAdmin();
  let referredBy: string | null = null;
  if (f.referral) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", Number(f.referral))
      .maybeSingle();
    if (!data) return { error: "That referral code wasn't found." };
    referredBy = data.id;
  }

  const pw = await admin.auth.admin.updateUserById(user.id, {
    password: pinPassword(user.email, f.pin),
  });
  if (pw.error) return { error: "Your PIN couldn't be saved. Try again." };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: code } = await admin.rpc("new_referral_code");
    const { error } = await admin.from("profiles").insert({
      id: user.id,
      first_name: f.firstName,
      last_name: f.lastName,
      nickname: f.nickname || null,
      use_nickname: f.useNickname,
      phone: f.phone || null,
      city: f.city,
      state: f.state,
      birthday: f.birthday,
      found_us: f.foundUs || null,
      referral_code: code,
      referred_by: referredBy,
      pin_set: true,
    });
    if (!error) redirect(safeNext(String(fd.get("next") ?? "")));
    if (error.code !== "23505" || error.message.includes("pkey")) {
      return { error: "Your profile couldn't be saved. Try again." };
    }
  }
  return { error: "Your profile couldn't be saved. Try again." };
}

/** Signed-in members (for example after an email link) choose a new PIN. */
async function savePin(_: FormState, fd: FormData): Promise<FormState> {
  const pin = String(fd.get("pin") ?? "");
  if (!validPin(pin) || pin !== String(fd.get("pin2") ?? "")) {
    return { error: "Enter the same 4-digit PIN twice." };
  }
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Your sign-in expired. Sign in again." };
  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: pinPassword(user.email, pin),
  });
  if (error) return { error: "Your PIN couldn't be saved. Try again." };
  await admin
    .from("pin_attempts")
    .delete()
    .eq("email_hash", emailHash(user.email));
  return { error: undefined };
}

async function callbackUrl(next: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

async function google(_: FormState, fd: FormData): Promise<FormState> {
  await rememberChoice(fd);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(String(fd.get("next") ?? "")) },
  });
  if (error || !data.url)
    return { error: "Google sign-in couldn't start. Try again." };
  redirect(data.url);
}

export type LinkState = { error?: string; sent?: string } | null;

async function emailLink(_: LinkState, fd: FormData): Promise<LinkState> {
  const email = normEmail(String(fd.get("email") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Enter your email." };
  await rememberChoice(fd);
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: await callbackUrl(String(fd.get("next") ?? "")),
    },
  });
  return error ? { error: error.message } : { sent: email };
}

// Server misconfiguration (a missing key) must not crash the page; it shows a plain message.
const unavailable = {
  error: "This is unavailable right now. Try Google or an email link.",
};
function guarded(fn: (s: FormState, fd: FormData) => Promise<FormState>) {
  return async (s: FormState, fd: FormData): Promise<FormState> => {
    try {
      return await fn(s, fd);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      console.error(e);
      return unavailable;
    }
  };
}
export const signInWithPin = guarded(pinSignIn);
export const createProfile = guarded(saveProfile);
export const changePin = guarded(savePin);
export const signInWithGoogle = guarded(google);
export async function sendEmailLink(
  s: LinkState,
  fd: FormData,
): Promise<LinkState> {
  try {
    return await emailLink(s, fd);
  } catch (e) {
    console.error(e);
    return unavailable;
  }
}
