import "server-only";
import { getConditions } from "@/lib/weather/conditions";
import { snap } from "@/lib/weather/geo";
import { getWeather } from "@/lib/weather/nws";
import { dayParts, rainTiming, type Brief } from "./compose";

type AlertJson = {
  features: {
    properties: {
      event: string;
      headline: string;
      ends: string | null;
      expires: string;
    };
  }[];
};

export async function buildBrief(lat: number, lon: number): Promise<Brief> {
  const [sLat, sLon] = snap(lat, lon);
  const [w, c, alerts] = await Promise.all([
    getWeather(sLat, sLon),
    getConditions(sLat, sLon),
    fetch(`https://api.weather.gov/alerts/active?point=${sLat},${sLon}`, {
      headers: {
        "User-Agent": "StormSync Weather (https://weather.sswx.space)",
        Accept: "application/geo+json",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => (r.ok ? (r.json() as Promise<AlertJson>) : { features: [] }))
      .catch(() => ({ features: [] })),
  ]);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: w.place.timeZone,
  }).format(new Date());
  const { today, tomorrow } = dayParts(w.daily, date);
  return {
    place: w.place.label,
    timeZone: w.place.timeZone,
    date,
    today,
    tomorrow,
    rain: rainTiming(w.hourly),
    spc: c.spc,
    alerts: alerts.features.slice(0, 5).map((f) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      ends: f.properties.ends ?? f.properties.expires ?? null,
    })),
  };
}
