import { cronAuthorized } from "@/lib/ops/cron-auth";
import { logSurges } from "@/lib/engines/surge";

export const maxDuration = 60;

/** Every 10 minutes (pg_cron "engine-surge"): logs storms whose lightning just jumped. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await logSurges());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
