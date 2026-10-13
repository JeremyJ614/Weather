import { revalidateTag } from "next/cache";
import { cronAuthorized } from "@/lib/ops/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { refreshWeatherNews, WEATHER_NEWS_TAG } from "@/lib/news/store";

/**
 * Daily at 7 AM Eastern. Vercel cron and the database scheduler both call it at 11 and 12 UTC;
 * only the run that lands on 7 AM New York time collects (daylight saving changes which one).
 * `?heal` (hourly) collects whenever the stored stories are missing or stale.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date());
  const q = new URL(request.url).searchParams;
  // Hourly safety net: collects only when the stored stories are missing or over a day old.
  if (q.has("heal")) {
    const { data } = await supabaseAdmin()
      .from("weather_news_items")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const age = data ? Date.now() - Date.parse(data.fetched_at) : Infinity;
    if (age < 26 * 3_600_000) return Response.json({ fresh: true });
  } else if (hour !== "7" && !q.has("force")) {
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
