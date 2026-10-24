import { cronAuthorized } from "@/lib/ops/cron-auth";
import { verifyChecks } from "@/lib/engines/verify";

export const maxDuration = 60;

/** Hourly (pg_cron "engine-verify"): checks engine flags against what really happened. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await verifyChecks());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
