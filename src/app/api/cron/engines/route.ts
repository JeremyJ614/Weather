import { cronAuthorized } from "@/lib/ops/cron-auth";
import { refreshWanted } from "@/lib/engines/stored";

export const maxDuration = 60;

/**
 * At :07, :27 and :47 (pg_cron job "engine-maps"): recomputes the stored engine maps that
 * visitors viewed in the last three hours once a newer HRRR run is out. Engines nobody is
 * looking at are left alone, so a quiet night costs nothing.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  // Run by GitHub Actions instead (scripts/jobs/run.ts), so Vercel does no work.
  if (process.env.JOBS_ON_ACTIONS === "1")
    return Response.json({ skipped: "runs on GitHub Actions" });
  try {
    return Response.json(await refreshWanted());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
