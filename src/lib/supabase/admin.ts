import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { actionsToken } from "@/lib/jobs/oidc";

/**
 * Service-role client. Server only; bypasses RLS, so use for trusted jobs alone. On GitHub
 * Actions (JOBS_RELAY set) it talks to the site's OIDC-checked relay instead, so the jobs run
 * there without the service key ever leaving Vercel.
 */
export function supabaseAdmin() {
  const relay = process.env.JOBS_RELAY;
  if (relay)
    return createClient(relay, "relay", {
      auth: { persistSession: false },
      global: {
        fetch: async (input, init) => {
          const t = await actionsToken();
          const headers = new Headers(init?.headers);
          headers.set("apikey", t);
          headers.set("authorization", `Bearer ${t}`);
          return fetch(input, { ...init, headers });
        },
      },
    });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server");
  const { supabaseUrl } = publicEnv();
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}
