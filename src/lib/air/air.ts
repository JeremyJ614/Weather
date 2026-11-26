import "server-only";
import { getWeather } from "@/lib/weather/nws";
import { snap } from "@/lib/weather/geo";
import { dispersalBand, dispersalScore, windMph } from "./scales";
import { meteoFetch } from "@/lib/meteo/fetch";

export type Pollutant = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  /** This pollutant's own AQI, when the source gives one. */
  aqi: number | null;
};
export type PollenType = {
  code: string;
  label: string;
  index: number;
  category: string;
  inSeason: boolean | null;
  advice: string[];
};
export type Plant = {
  code: string;
  label: string;
  index: number | null;
  category: string | null;
  inSeason: boolean | null;
  type: string | null;
  family: string | null;
  season: string | null;
  look: string | null;
  crossReaction: string | null;
  picture: string | null;
};

export type AirReport = {
  aqi: {
    source: "AirNow" | "Open-Meteo";
    now: number | null;
    pollutant: string | null;
    days: { date: string; aqi: number }[];
    pollutants: Pollutant[];
    hours: { at: string; aqi: number }[];
  } | null;
  pollen:
    | {
        kind: "counts";
        source: "Google Pollen";
        days: { date: string; types: PollenType[] }[];
        plants: Plant[];
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
    const r = await meteoFetch(url, {
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
      const pollutants = obs.map((o) => ({
        id: o.ParameterName,
        label: o.ParameterName === "O3" ? "Ozone" : o.ParameterName,
        value: null,
        unit: "",
        aqi: o.AQI,
      }));
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
        pollutants,
        hours: [],
      };
    }
  }
  // Open-Meteo is free for non-commercial use; switch to AirNow before paid plans launch.
  const om = await get<{
    utc_offset_seconds: number;
    current: Record<string, number | null>;
    hourly: { time: string[]; us_aqi: (number | null)[] };
  }>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide&hourly=us_aqi&timezone=auto&forecast_days=4`,
    1800,
  );
  if (!om) return null;
  const days = new Map<string, number>();
  om.hourly.time.forEach((t, i) => {
    const v = om.hourly.us_aqi[i];
    if (v != null)
      days.set(t.slice(0, 10), Math.max(days.get(t.slice(0, 10)) ?? 0, v));
  });
  const c = om.current;
  const P = (id: string, label: string, key: string, unit: string) => ({
    id,
    label,
    value: c[key] == null ? null : Math.round(Number(c[key]) * 10) / 10,
    unit,
    aqi:
      c[`us_aqi_${key}`] == null
        ? null
        : Math.round(Number(c[`us_aqi_${key}`])),
  });
  const pollutants = [
    P("PM2.5", "Fine particles", "pm2_5", "µg/m³"),
    P("PM10", "Coarse particles", "pm10", "µg/m³"),
    P("O3", "Ozone", "ozone", "µg/m³"),
    P("NO2", "Nitrogen dioxide", "nitrogen_dioxide", "µg/m³"),
    P("SO2", "Sulfur dioxide", "sulphur_dioxide", "µg/m³"),
    P("CO", "Carbon monoxide", "carbon_monoxide", "µg/m³"),
  ];
  const lead = pollutants
    .filter((x) => x.aqi != null)
    .reduce<(typeof pollutants)[number] | null>(
      (a, b) => (!a || (b.aqi ?? 0) > (a.aqi ?? 0) ? b : a),
      null,
    );
  // Hourly from the current local hour on (Open-Meteo times are local, without an offset).
  const nowKey = new Date(Date.now() + om.utc_offset_seconds * 1000)
    .toISOString()
    .slice(0, 13);
  const start = Math.max(
    0,
    om.hourly.time.findIndex((t) => t.slice(0, 13) >= nowKey),
  );
  return {
    source: "Open-Meteo",
    now: c.us_aqi == null ? null : Math.round(Number(c.us_aqi)),
    pollutant: lead?.id ?? null,
    days: [...days].map(([date, a]) => ({ date, aqi: Math.round(a) })),
    pollutants,
    hours: om.hourly.time
      .map((t, i) => ({ at: t, aqi: om.hourly.us_aqi[i] }))
      .slice(start, start + 48)
      .filter((h): h is { at: string; aqi: number } => h.aqi != null)
      .map((h) => ({ at: h.at, aqi: Math.round(h.aqi) })),
  };
}

/**
 * Real counts, plant details and health advice from Google's Pollen API when
 * GOOGLE_POLLEN_KEY is set (licensed for commercial use); otherwise a dispersal reading.
 */
async function pollen(lat: number, lon: number): Promise<AirReport["pollen"]> {
  const key = process.env.GOOGLE_POLLEN_KEY;
  if (key) {
    const g = await get<{
      dailyInfo: {
        date: { year: number; month: number; day: number };
        pollenTypeInfo?: {
          code: string;
          displayName: string;
          inSeason?: boolean;
          indexInfo?: { value: number; category: string };
          healthRecommendations?: string[];
        }[];
        plantInfo?: {
          code: string;
          displayName: string;
          inSeason?: boolean;
          indexInfo?: { value: number; category: string };
          plantDescription?: {
            type?: string;
            family?: string;
            season?: string;
            specialColors?: string;
            specialShapes?: string;
            crossReaction?: string;
            picture?: string;
          };
        }[];
      }[];
    }>(
      `https://pollen.googleapis.com/v1/forecast:lookup?key=${key}&location.latitude=${lat}&location.longitude=${lon}&days=5&plantsDescription=true`,
      6 * 3600,
    );
    if (g?.dailyInfo?.length) {
      const first = g.dailyInfo[0];
      return {
        kind: "counts",
        source: "Google Pollen",
        days: g.dailyInfo.map((d) => ({
          date: `${d.date.year}-${String(d.date.month).padStart(2, "0")}-${String(d.date.day).padStart(2, "0")}`,
          types: (d.pollenTypeInfo ?? []).map((t) => ({
            code: t.code,
            label: t.displayName,
            index: t.indexInfo?.value ?? 0,
            category: t.indexInfo?.category ?? "None",
            inSeason: t.inSeason ?? null,
            advice: t.healthRecommendations ?? [],
          })),
        })),
        plants: (first.plantInfo ?? []).map((p) => ({
          code: p.code,
          label: p.displayName,
          index: p.indexInfo?.value ?? null,
          category: p.indexInfo?.category ?? null,
          inSeason: p.inSeason ?? null,
          type: p.plantDescription?.type ?? null,
          family: p.plantDescription?.family ?? null,
          season: p.plantDescription?.season ?? null,
          look:
            [
              p.plantDescription?.specialShapes,
              p.plantDescription?.specialColors,
            ]
              .filter(Boolean)
              .join(" ") || null,
          crossReaction: p.plantDescription?.crossReaction ?? null,
          picture: p.plantDescription?.picture ?? null,
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
