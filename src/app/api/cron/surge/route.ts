import { cronAuthorized } from "@/lib/ops/cron-auth";
import { logSurges } from "@/lib/engines/surge";

export const maxDuration = 60;

/** Every 10 minutes (pg_cron "engine-surge"): logs storms whose lightning just jumped. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  // Run by GitHub Actions instead (scripts/jobs/run.ts), so Vercel does no work.
  if (process.env.JOBS_ON_ACTIONS === "1")
    return Response.json({ skipped: "runs on GitHub Actions" });
  try {
    return Response.json(await logSurges());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
