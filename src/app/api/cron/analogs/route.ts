import { cronAuthorized } from "@/lib/ops/cron-auth";
import { runAnalogs } from "@/lib/analogs/analogs";

export const maxDuration = 60;

/** Four times a day (pg_cron "engine-analogs"): today's and tomorrow's analogs, and scoring. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await runAnalogs(new URL(request.url).origin));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
