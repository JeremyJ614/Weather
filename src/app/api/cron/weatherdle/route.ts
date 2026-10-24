import { cronAuthorized } from "@/lib/ops/cron-auth";
import { gameDate } from "@/lib/game/score";
import { ensureWord } from "@/lib/weatherdle/make";

export const maxDuration = 60;

/** Just after midnight Eastern (pg_cron "weatherdle-daily"): makes today's Weatherdle word. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await ensureWord(gameDate()));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
