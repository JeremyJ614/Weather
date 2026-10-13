import "server-only";
import { parseFeed, rank, severityOf, snippet, type Story } from "./feed";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const FEEDS = [
  { source: "SPC", url: "https://www.spc.noaa.gov/products/spcrss.xml" },
  { source: "NHC", url: "https://www.nhc.noaa.gov/index-at.xml" },
  { source: "NHC", url: "https://www.nhc.noaa.gov/index-ep.xml" },
  { source: "NOAA", url: "https://www.noaa.gov/rss.xml" },
  {
    source: "NASA Earth",
    url: "https://earthobservatory.nasa.gov/feeds/earth-observatory.rss",
  },
  {
    source: "Climate.gov",
    url: "https://www.climate.gov/feeds/news-features/highlights.rss",
  },
  { source: "NPR Climate", url: "https://feeds.npr.org/1025/rss.xml" },
];

async function fromFeed(source: string, url: string): Promise<Story[]> {
  const res = await fetch(url, {
    headers: UA,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${source} ${res.status}`);
  return parseFeed(await res.text()).flatMap((it) => {
    const severity = severityOf(source, it.title);
    if (severity === null || !it.title || !/^https?:\/\//.test(it.link))
      return [];
    return [
      {
        url: it.link.slice(0, 500),
        title: it.title.slice(0, 300),
        source,
        snippet: snippet(it.text),
        severity,
        published_at: it.date,
      },
    ];
  });
}

type Alert = {
  properties: {
    id: string;
    event: string;
    headline: string;
    areaDesc: string;
    sent: string;
  };
};

/** NWS's most severe active alerts, one story per kind of event. */
async function fromNws(): Promise<Story[]> {
  const res = await fetch(
    "https://api.weather.gov/alerts/active?status=actual&message_type=alert&severity=Extreme",
    {
      headers: { ...UA, Accept: "application/geo+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  const byEvent = new Map<string, Alert["properties"][]>();
  for (const f of ((await res.json()) as { features: Alert[] }).features) {
    byEvent.set(f.properties.event, [
      ...(byEvent.get(f.properties.event) ?? []),
      f.properties,
    ]);
  }
  return [...byEvent.entries()].map(([event, list]) => ({
    url: `https://alerts.weather.gov/search?event=${encodeURIComponent(event)}`,
    title:
      list.length > 1 ? `${event}: ${list.length} active` : list[0].headline,
    source: "NWS",
    snippet: snippet(list.map((a) => a.areaDesc).join("; ")),
    severity: 100,
    published_at:
      list
        .map((a) => a.sent)
        .sort()
        .at(-1) ?? null,
  }));
}

/** Collects every source; a source that fails is skipped and reported. */
export async function collectStories(): Promise<{
  stories: Story[];
  failed: string[];
}> {
  const jobs = [
    ...FEEDS.map((f) => ({
      name: f.source,
      run: () => fromFeed(f.source, f.url),
    })),
    { name: "NWS", run: fromNws },
  ];
  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  const failed = results.flatMap((r, i) =>
    r.status === "rejected" ? [jobs[i].name] : [],
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { stories: rank(all), failed };
}
