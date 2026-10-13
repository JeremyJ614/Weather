import { TodayCard } from "@/features/weather/TodayCard";
import { WeatherClock } from "@/features/home/WeatherClock";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getSiteDefaults } from "@/lib/settings";
import { WeatherNews } from "@/features/news/WeatherNews";
import { HomeTabs } from "@/features/news/HomeTabs";
import { SswxNews } from "@/features/news/SswxNews";
import { AppUpdates } from "@/features/news/AppUpdates";
import { coverUrl, excerpt, getPublishedPosts } from "@/lib/news/posts";

export default async function Home() {
  const [{ disabled }, posts] = await Promise.all([
    getSiteDefaults(),
    getPublishedPosts(),
  ]);
  const cards = posts.map((p) => ({
    id: p.id,
    title: p.title,
    cover: coverUrl(p.cover_path),
    publish_at: p.publish_at,
    excerpt: excerpt(p.body, 140, Boolean(p.rich)),
  }));
  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 pt-2 pb-28">
      {!disabled.includes("weather") && <WeatherClock />}
      <div className="mx-auto grid w-full max-w-xl gap-5">
        {disabled.includes("weather") ? (
          <ModuleOff label="The local forecast" />
        ) : (
          <TodayCard />
        )}
        <HomeTabs
          label="News"
          tabs={[
            {
              id: "weather-news",
              label: "Weather News",
              panel: disabled.includes("weather-news") ? (
                <ModuleOff label="Weather News" />
              ) : (
                <WeatherNews />
              ),
            },
            {
              id: "sswx-news",
              label: "SSWX News",
              panel: disabled.includes("news") ? (
                <ModuleOff label="SSWX News" />
              ) : (
                <SswxNews posts={cards} />
              ),
            },
            {
              id: "app-updates",
              label: "App Updates",
              panel: <AppUpdates />,
            },
          ]}
        />
      </div>
    </main>
  );
}
