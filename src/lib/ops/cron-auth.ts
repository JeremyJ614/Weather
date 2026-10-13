import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Vercel cron (CRON_SECRET) or the database scheduler (a token kept in Supabase Vault). */
export async function cronAuthorized(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  try {
    const { data } = await supabaseAdmin().rpc("cron_token_ok", { t: token });
    return data === true;
  } catch {
    return false;
  }
}
