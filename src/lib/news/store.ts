import "server-only";
import { revalidateTag } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { collectStories } from "./collect";

export const WEATHER_NEWS_TAG = "weather-news";

/** Collects all sources and replaces today's stories (at most 40 rows). Server key required. */
export async function refreshWeatherNews() {
  const started = new Date().toISOString();
  const { stories, failed } = await collectStories();
  if (!stories.length) return { saved: 0, failed };
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const up = await db
    .from("weather_news_items")
    .upsert(stories.map((s) => ({ ...s, fetched_at: now })));
  if (up.error) throw new Error(up.error.message);
  await db.from("weather_news_items").delete().lt("fetched_at", started);
  return { saved: stories.length, failed };
}

let lastTry = 0;

/**
 * Self-heal: when the stored stories are missing or over a day old (a missed
 * cron run), collect now. Runs after the response; at most every 15 minutes
 * per server instance.
 */
export async function refreshIfStale(fetchedAt: string | null) {
  const now = Date.now();
  if (fetchedAt && now - Date.parse(fetchedAt) < 26 * 3_600_000) return;
  if (now - lastTry < 15 * 60_000 || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return;
  lastTry = now;
  try {
    const { saved } = await refreshWeatherNews();
    if (saved) revalidateTag(WEATHER_NEWS_TAG, { expire: 0 });
  } catch (e) {
    console.error("weather news self-heal failed", e);
  }
}
