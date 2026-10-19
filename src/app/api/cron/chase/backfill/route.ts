import { cronAuthorized } from "@/lib/ops/cron-auth";
import { backfillChase } from "@/lib/chase/engine";

export const maxDuration = 60;

/**
 * Every 30 minutes (pg_cron "chase-backfill"): rebuilds this year's missing chase days from
 * SPC's archived outlooks and archived model runs, three at a time for as long as the
 * function allows. Once the year is full it only reads the list of days, and it refills any
 * day a daily scan ever misses.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await backfillChase());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
