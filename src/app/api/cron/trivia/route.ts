import { cronAuthorized } from "@/lib/ops/cron-auth";
import { gameDate } from "@/lib/game/score";
import { ensureDay } from "@/lib/trivia/generate";

/** Just after midnight Eastern (database scheduler): makes today's trivia questions. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  return Response.json(await ensureDay(gameDate()));
}
