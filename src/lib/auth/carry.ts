import "server-only";
import { publicEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The Supabase project move (owner, 2026-11-26): password hashes can't leave a project, so a
 * member's first sign-in after the move is checked by the old project. If it accepts, the new
 * project takes the same password (a PIN is a password) and the sign-in is tried again. Only an
 * account with no password here yet is filled, so a PIN changed after the move can never be
 * replaced by the old one, and members who already carried theirs never reach the old project.
 * Does nothing while the site still runs on the old project.
 */
const OLD_URL = "https://ztzqemzuanwqwqzsaigd.supabase.co";
// The old project's public (publishable) key: the same one its pages have always shipped.
const OLD_KEY = "sb_publishable_524pcbnxZXnvh3AL-UPm9A_cxQj3oNq";

export async function carryPassword(email: string, password: string) {
  if (publicEnv().supabaseUrl.replace(/\/$/, "") === OLD_URL) return false;
  const admin = supabaseAdmin();
  const { data: unset } = await admin.rpc("password_unset", { e: email });
  if (unset !== true) return false;
  const r = await fetch(`${OLD_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: OLD_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return false;
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string;
    user?: { id?: string; email?: string };
  };
  // Only the old project's answer was needed: end the session it just opened.
  if (j.access_token)
    void fetch(`${OLD_URL}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: OLD_KEY, authorization: `Bearer ${j.access_token}` },
    }).catch(() => {});
  const id = j.user?.id;
  if (!id || j.user?.email?.toLowerCase() !== email.toLowerCase()) return false;
  // Members kept their ids in the move, so the same id names them here.
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  return !error;
}
