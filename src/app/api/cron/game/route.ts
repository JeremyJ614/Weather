import { cronAuthorized } from "@/lib/ops/cron-auth";
import { scoreRound, settleMonth } from "@/lib/game/run";
import { gameDate } from "@/lib/game/score";

/**
 * Daily at 13:20 UTC (vercel.json), after SPC's convective day closes at 12Z:
 * scores yesterday's Forecast Game round and, on the 1st, crowns the month.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const yesterday = gameDate(new Date(Date.now() - 86_400_000));
  // Score first: on the 1st, yesterday is the month's last day and must count.
  const round = await scoreRound(yesterday);
  const month = await settleMonth();
  return Response.json({ date: yesterday, ...round, settled: month });
}
