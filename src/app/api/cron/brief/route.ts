import { deliverBriefs } from "@/lib/brief/deliver";
import { cronAuthorized } from "@/lib/ops/cron-auth";

/**
 * Hourly. Vercel's free plan only runs daily jobs, so the database scheduler (pg_cron + pg_net,
 * job "daily-brief-hourly") calls this at :05 every hour with a token from Supabase Vault.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await deliverBriefs());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
