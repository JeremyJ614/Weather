import { cronAuthorized } from "@/lib/ops/cron-auth";
import { saveChase } from "@/lib/chase/engine";

export const maxDuration = 60;

/**
 * Daily at 16:40 UTC (vercel.json), after SPC's 1630Z Day 1 outlook: scans for the day's
 * two best chase targets and saves the day to chase_days (the yearly stats build from it).
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    const d = await saveChase();
    return Response.json({
      day: d.day,
      targets: d.targets.map((t) => [t.place, t.score]),
      candidates: d.candidates,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
