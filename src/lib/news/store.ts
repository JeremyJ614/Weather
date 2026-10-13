import "server-only";
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
