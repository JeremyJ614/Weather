import "server-only";
import { getWeather } from "@/lib/weather/nws";
import { snap } from "@/lib/weather/geo";
import { dispersalBand, dispersalScore, windMph } from "./scales";

export type AirReport = {
  aqi: {
    source: "AirNow" | "Open-Meteo";
    now: number | null;
    pollutant: string | null;
    days: { date: string; aqi: number }[];
  } | null;
  pollen:
    | {
        kind: "counts";
        source: "Google Pollen";
        days: {
          date: string;
          types: { label: string; index: number; category: string }[];
        }[];
      }
    | {
        kind: "dispersal";
        timeZone: string;
        hours: { at: string; score: number; band: string }[];
        peak: { at: string; score: number; band: string } | null;
      }
    | null;
};

const get = async <T>(url: string, revalidate: number): Promise<T | null> => {
  try {
    const r = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

/** EPA AirNow when AIRNOW_API_KEY is set (official, free for commercial use); otherwise Open-Meteo. */
async function aqi(lat: number, lon: number): Promise<AirReport["aqi"]> {
  const key = process.env.AIRNOW_API_KEY;
  if (key) {
    const base = `https://www.airnowapi.org/aq`;
    const q = `format=application/json&latitude=${lat}&longitude=${lon}&distance=50&API_KEY=${key}`;
    const [obs, fc] = await Promise.all([
      get<{ AQI: number; ParameterName: string }[]>(
        `${base}/observation/latLong/current/?${q}`,
        1800,
      ),
      get<{ DateForecast: string; AQI: number }[]>(
        `${base}/forecast/latLong/?${q}`,
        3600,
      ),
    ]);
    if (obs?.length) {
      const top = obs.reduce((a, b) => (b.AQI > a.AQI ? b : a));
      const days = new Map<string, number>();
      (fc ?? []).forEach(
        (f) =>
          f.AQI >= 0 &&
          days.set(
            f.DateForecast.trim(),
            Math.max(days.get(f.DateForecast.trim()) ?? 0, f.AQI),
          ),
      );
      return {
        source: "AirNow",
        now: top.AQI,
        pollutant: top.ParameterName,
        days: [...days].map(([date, a]) => ({ date, aqi: a })),
      };
    }
  }
  // Open-Meteo is free for non-commercial use; switch to AirNow before paid plans launch.
  const om = await get<{
    current: { us_aqi: number; pm2_5: number; ozone: number };
    hourly: { time: string[]; us_aqi: (number | null)[] };
  }>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,ozone&hourly=us_aqi&timezone=auto&forecast_days=4`,
    1800,
  );
  if (!om) return null;
  const days = new Map<string, number>();
  om.hourly.time.forEach((t, i) => {
    const v = om.hourly.us_aqi[i];
    if (v != null)
      days.set(t.slice(0, 10), Math.max(days.get(t.slice(0, 10)) ?? 0, v));
  });
  return {
    source: "Open-Meteo",
    now: om.current.us_aqi ?? null,
    pollutant: om.current.pm2_5 >= om.current.ozone / 2 ? "PM2.5" : "Ozone",
    days: [...days].map(([date, a]) => ({ date, aqi: Math.round(a) })),
  };
}

/** Real counts from Google's Pollen API when GOOGLE_POLLEN_KEY is set; otherwise a dispersal reading. */
async function pollen(lat: number, lon: number): Promise<AirReport["pollen"]> {
  const key = process.env.GOOGLE_POLLEN_KEY;
  if (key) {
    const g = await get<{
      dailyInfo: {
        date: { year: number; month: number; day: number };
        pollenTypeInfo?: {
          displayName: string;
          indexInfo?: { value: number; category: string };
        }[];
      }[];
    }>(
      `https://pollen.googleapis.com/v1/forecast:lookup?key=${key}&location.latitude=${lat}&location.longitude=${lon}&days=5`,
      6 * 3600,
    );
    if (g?.dailyInfo?.length) {
      return {
        kind: "counts",
        source: "Google Pollen",
        days: g.dailyInfo.map((d) => ({
          date: `${d.date.year}-${String(d.date.month).padStart(2, "0")}-${String(d.date.day).padStart(2, "0")}`,
          types: (d.pollenTypeInfo ?? [])
            .filter((t) => t.indexInfo)
            .map((t) => ({
              label: t.displayName,
              index: t.indexInfo!.value,
              category: t.indexInfo!.category,
            })),
        })),
      };
    }
  }
  try {
    const w = await getWeather(lat, lon);
    const hourOf = (iso: string) =>
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: w.place.timeZone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date(iso)),
      );
    const hours = w.hourly.slice(0, 24).map((h) => {
      const wind = windMph(h.wind);
      const score = dispersalScore({
        temp: h.temp,
        humidity: h.rh ?? 60,
        wind,
        gust: wind * 1.4,
        rainChance: h.pop ?? 0,
        hour: hourOf(h.start),
      });
      return { at: h.start, score, band: dispersalBand(score) };
    });
    const peak = hours.reduce<(typeof hours)[number] | null>(
      (a, b) => (!a || b.score > a.score ? b : a),
      null,
    );
    return { kind: "dispersal", timeZone: w.place.timeZone, hours, peak };
  } catch {
    return null;
  }
}

export async function getAir(lat: number, lon: number): Promise<AirReport> {
  const [sLat, sLon] = snap(lat, lon);
  const [a, p] = await Promise.all([aqi(sLat, sLon), pollen(sLat, sLon)]);
  return { aqi: a, pollen: p };
}
