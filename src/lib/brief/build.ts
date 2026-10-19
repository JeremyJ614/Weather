import "server-only";
import { getConditions } from "@/lib/weather/conditions";
import { getAir } from "@/lib/air/air";
import { snap } from "@/lib/weather/geo";
import { getWeather } from "@/lib/weather/nws";
import { moonPhase, sunTimes } from "@/lib/weather/astro";
import { windMph } from "@/lib/air/scales";
import { dayParts, rainTiming, type Brief } from "./compose";
import { dayParts24 } from "./parts";

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
  const [w, c, air, alerts] = await Promise.all([
    getWeather(sLat, sLon),
    getConditions(sLat, sLon),
    getAir(sLat, sLon).catch(() => null),
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
  const hours = w.hourly.slice(0, 24);
  const sun = sunTimes(sLat, sLon, new Date(`${date}T12:00:00Z`));
  const moon = moonPhase(new Date());
  return {
    place: w.place.label,
    timeZone: w.place.timeZone,
    date,
    today,
    tomorrow,
    rain: rainTiming(w.hourly),
    spc: c.spc,
    aqi: air?.aqi?.now ?? null,
    alerts: alerts.features.slice(0, 5).map((f) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      ends: f.properties.ends ?? f.properties.expires ?? null,
    })),
    extra: {
      parts: dayParts24(w.hourly, w.place.timeZone),
      pops: hours.map((h) => h.pop ?? 0),
      mid: hours[12]?.start ?? null,
      end: hours.at(-1)?.start ?? null,
      sunrise: sun.rise?.toISOString() ?? null,
      sunset: sun.set?.toISOString() ?? null,
      gust: Math.max(0, ...hours.map((h) => windMph(h.wind))),
      moon: { name: moon.name, pct: Math.round(moon.illumination * 100) },
    },
  };
}
