/* eslint-disable @next/next/no-img-element -- a single small local logo */
import { TodayCard } from "@/features/weather/TodayCard";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getSiteDefaults } from "@/lib/settings";
import { WeatherNews } from "@/features/news/WeatherNews";

export default async function Home() {
  const { disabled } = await getSiteDefaults();
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
        forecast and Weather News work now; SSWX News and App Updates come next.
      </p>
      {disabled.includes("weather") ? (
        <ModuleOff label="The local forecast" />
      ) : (
        <TodayCard />
      )}
    </main>
  );
}
