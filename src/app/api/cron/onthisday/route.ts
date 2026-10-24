import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { ensureDay, todayMd } from "@/lib/history/days";

export const maxDuration = 60;

/** After midnight Central (pg_cron "on-this-day"): today's and tomorrow's dates, ready. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const out = [];
  for (const at of [new Date(), new Date(Date.now() + 86400_000)]) {
    const md = todayMd(at);
    try {
      out.push(await ensureDay(md));
      revalidateTag(`history:${md}`, { expire: 0 });
    } catch (e) {
      out.push({ md, error: e instanceof Error ? e.message : "failed" });
    }
  }
  return Response.json(out);
}
