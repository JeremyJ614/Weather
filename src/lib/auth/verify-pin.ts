import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { afterFailure, lockedUntil, type Attempts } from "./lockout";
import { emailHash, pinPassword, validPin } from "./pin";

/**
 * Checks a signed-in member's current PIN before an account change, with the same lockout as
 * signing in (five wrong PINs locks the email). A throwaway client keeps the member's own
 * session untouched.
 */
export async function verifyPin(
  email: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!validPin(pin)) return { ok: false, error: "Enter your 4-digit PIN." };
  const admin = supabaseAdmin();
  const hash = emailHash(email);
  const { data: row } = await admin
    .from("pin_attempts")
    .select("failures, locks, locked_until")
    .eq("email_hash", hash)
    .maybeSingle<Attempts>();
  const until = lockedUntil(row);
  if (until)
    return {
      ok: false,
      error: `Too many wrong PINs. Try again in ${Math.ceil((until - Date.now()) / 60000)} minutes.`,
    };
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const probe = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({
    email,
    password: pinPassword(email, pin),
  });
  if (error) {
    await admin.from("pin_attempts").upsert({
      email_hash: hash,
      ...afterFailure(row),
      updated_at: new Date().toISOString(),
    });
    return { ok: false, error: "That PIN isn't right." };
  }
  // End only the throwaway session; the member stays signed in everywhere else.
  await probe.auth.signOut({ scope: "local" });
  return { ok: true };
}
