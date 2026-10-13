import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { refreshWeatherNews, WEATHER_NEWS_TAG } from "@/lib/news/store";

/**
 * Daily at 7 AM Eastern. Vercel cron and the database scheduler both call it at 11 and 12 UTC;
 * only the run that lands on 7 AM New York time collects (daylight saving changes which one).
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date());
  if (hour !== "7" && !new URL(request.url).searchParams.has("force")) {
    return Response.json({ skipped: `It is ${hour}:00 in New York` });
  }
  try {
    const result = await refreshWeatherNews();
    revalidateTag(WEATHER_NEWS_TAG, { expire: 0 });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
