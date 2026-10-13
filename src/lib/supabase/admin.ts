import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/** Service-role client. Server only; bypasses RLS, so use for trusted jobs alone. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server");
  const { supabaseUrl } = publicEnv();
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}
