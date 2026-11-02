import { cronAuthorized } from "@/lib/ops/cron-auth";
import { backfillMonth, refresh } from "@/lib/archive/auto";

export const maxDuration = 60;

/**
 * Tornado Archive auto-update (pg_cron "archive-auto", every 6 hours): rebuilds the last 60
 * days of NWS-surveyed tornado days, then (time allowing) steps the backfill one month further
 * toward January 2023, so the backfill finishes even if its own schedule was retired. With
 * ?backfill=1 ("archive-backfill", twice an hour) it only steps the backfill.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    if (new URL(request.url).searchParams.has("backfill"))
      return Response.json(await backfillMonth());
    const to = new Date(Date.now() + 864e5);
    const from = new Date(to.getTime() - 61 * 864e5);
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(0, 0, 0, 0);
    const began = Date.now();
    const recent = await refresh(from, to);
    const back =
      Date.now() - began < 25_000
        ? await backfillMonth().catch((e: Error) => ({ error: e.message }))
        : null;
    return Response.json({ ...recent, backfill: back });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
