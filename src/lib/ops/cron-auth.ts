import "server-only";
import { isJobsToken } from "@/lib/jobs/oidc";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { track } from "./usage";

/**
 * Vercel cron (CRON_SECRET), the database scheduler (a token kept in Supabase Vault), or this
 * repository's jobs workflow on GitHub Actions (its OIDC token, the one the database relay
 * already trusts), so a job can be re-run by hand: `jobs.yml` job `cron` with the route.
 */
export async function cronAuthorized(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  track(`cron${new URL(request.url).pathname.replace("/api/cron", "")}`);
  const token = auth.slice(7);
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  if (token.split(".").length === 3 && (await isJobsToken(token))) return true;
  try {
    const { data } = await supabaseAdmin().rpc("cron_token_ok", { t: token });
    return data === true;
  } catch {
    return false;
  }
}
