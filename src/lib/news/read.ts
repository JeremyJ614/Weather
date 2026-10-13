import { curate, rank, type Story } from "./feed";

/** Today's top stories with the admin's pins and hides applied. Cached; the collector refreshes it. */
export async function getWeatherNews(top = 15) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { stories: [], fetchedAt: null };
  const opts = {
    headers: { apikey: key },
    next: { revalidate: 3600, tags: ["weather-news"] },
  };
  try {
    const [items, cur] = await Promise.all([
      fetch(`${url}/rest/v1/weather_news_items?select=*`, opts).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch(
        `${url}/rest/v1/news_curation?select=url,action,position`,
        opts,
      ).then((r) => (r.ok ? r.json() : [])),
    ]);
    const list = items as (Story & { fetched_at: string })[];
    return {
      stories: curate(rank(list, 40, 40), cur, top),
      fetchedAt:
        list
          .map((s) => s.fetched_at)
          .sort()
          .at(-1) ?? null,
    };
  } catch {
    return { stories: [], fetchedAt: null };
  }
}
