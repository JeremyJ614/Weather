import { cronAuthorized } from "@/lib/ops/cron-auth";
import { refreshOutdoorIfStale } from "@/lib/engines/outmap";

export const maxDuration = 60;

/**
 * Hourly at :37 (pg_cron job "engine-outdoor"): recomputes the Deer and Fishing outlooks once
 * a newer GFS run is out or Day 1 has moved on; otherwise one quick look at the model.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  // Run by GitHub Actions instead (scripts/jobs/run.ts), so Vercel does no work.
  if (process.env.JOBS_ON_ACTIONS === "1")
    return Response.json({ skipped: "runs on GitHub Actions" });
  try {
    return Response.json(await refreshOutdoorIfStale());
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
