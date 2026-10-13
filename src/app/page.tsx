/* eslint-disable @next/next/no-img-element -- a single small local logo */
import { TodayCard } from "@/features/weather/TodayCard";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getSiteDefaults } from "@/lib/settings";
import { WeatherNews } from "@/features/news/WeatherNews";
import { HomeTabs } from "@/features/news/HomeTabs";
import { SswxNews } from "@/features/news/SswxNews";
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
    excerpt: excerpt(p.body),
  }));
  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-xl flex-col justify-center gap-5 px-4 py-12">
      <img
        src="/brand/logo-primary.webp"
        alt="StormSync Media"
        width={240}
        height={71}
      />
      <h1 className="display text-4xl">StormSync Weather is being built</h1>
      <p className="text-muted">
        The app is under construction, one tested phase at a time. Your local
        forecast, Weather News and SSWX News work now; App Updates comes next.
      </p>
      {disabled.includes("weather") ? (
        <ModuleOff label="The local forecast" />
      ) : (
        <TodayCard />
      )}
      <HomeTabs
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
        ]}
      />
    </main>
  );
}
