import { runNotify } from "@/lib/notify/deliver";
import { cronAuthorized } from "@/lib/ops/cron-auth";

export const maxDuration = 60;

/**
 * Every 10 minutes. The database scheduler (pg_cron + pg_net, job "notify-10min") calls this
 * with a token from Supabase Vault; Vercel's free plan only runs daily jobs.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await runNotify());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
