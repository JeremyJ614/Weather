import "server-only";

/** Upstream sources the app depends on, checked live from the admin panel. */
const FEEDS = [
  { name: "NWS forecasts", url: "https://api.weather.gov/" },
  {
    name: "SPC outlooks",
    url: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
  },
  { name: "NHC storms", url: "https://www.nhc.noaa.gov/CurrentStorms.json" },
  {
    name: "USGS earthquakes",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson",
  },
  { name: "MRMS radar", url: "https://mrms.ncep.noaa.gov/data/" },
  { name: "ZIP lookup", url: "https://api.zippopotam.us/us/73019" },
  {
    name: "OpenFreeMap tiles",
    url: "https://tiles.openfreemap.org/styles/dark",
  },
];

export type FeedResult = {
  name: string;
  ok: boolean;
  status: number | string;
  ms: number;
};

export async function checkFeeds(): Promise<FeedResult[]> {
  return Promise.all(
    FEEDS.map(async ({ name, url }) => {
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
          headers: {
            "User-Agent": "StormSync Weather (https://weather.sswx.space)",
          },
        });
        await res.body?.cancel();
        return { name, ok: res.ok, status: res.status, ms: Date.now() - t0 };
      } catch (e) {
        const timeout = (e as Error).name === "TimeoutError";
        return {
          name,
          ok: false,
          status: timeout ? "timeout" : "unreachable",
          ms: Date.now() - t0,
        };
      }
    }),
  );
}
