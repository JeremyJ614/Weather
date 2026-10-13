import { ExternalLink, Pin } from "lucide-react";
import { after } from "next/server";
import { getWeatherNews } from "@/lib/news/read";
import { refreshIfStale } from "@/lib/news/store";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Weather News tab: today's top 15 official and science stories, most severe first. */
export async function WeatherNews() {
  const { stories, fetchedAt } = await getWeatherNews();
  after(() => refreshIfStale(fetchedAt));
  if (!stories.length) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        Today&apos;s weather stories are being collected now. Check back in a
        few minutes.
      </p>
    );
  }
  return (
    <section className="grid gap-3" aria-labelledby="wn-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="wn-title" className="display text-2xl text-accent">
          Weather News
        </h2>
        {fetchedAt && (
          <span className="mono text-xs text-muted">{fmt(fetchedAt)} ET</span>
        )}
      </div>
      <ol className="grid gap-2">
        {stories.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`grid gap-1 rounded-2xl border bg-surface p-4 transition-transform active:scale-[.98] ${
                s.severity >= 78 ? "border-accent" : "border-line"
              }`}
            >
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="font-bold text-accent">{s.source}</span>
                {s.published_at && <span>{fmt(s.published_at)} ET</span>}
                {s.pinned && (
                  <span className="flex items-center gap-1 text-accent">
                    <Pin className="size-3" aria-hidden /> Pinned
                  </span>
                )}
                <ExternalLink
                  className="ml-auto size-3.5"
                  aria-label="Opens the source site"
                />
              </span>
              <span className="font-bold">{s.title}</span>
              {s.snippet && (
                <span className="text-sm text-muted">{s.snippet}</span>
              )}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
