import "server-only";
import { cToF, snap } from "./geo";
import type { Hour, Period, PlaceInfo, WeatherBundle } from "./types";

// NWS asks every app to identify itself.
const HEADERS = {
  "User-Agent": "StormSync Weather (https://weather.sswx.space)",
  Accept: "application/geo+json",
};

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function nws<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate } });
  if (res.status === 404) {
    throw new UpstreamError(
      "The National Weather Service has no forecast for this place",
      404,
    );
  }
  if (!res.ok)
    throw new UpstreamError(
      `National Weather Service error ${res.status}`,
      502,
    );
  return res.json() as Promise<T>;
}

type PointJson = {
  properties: {
    gridId: string;
    forecast: string;
    forecastHourly: string;
    timeZone: string;
    radarStation: string;
    relativeLocation: { properties: { city: string; state: string } };
  };
};

type RawPeriod = {
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation?: { value: number | null };
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  dewpoint?: { value: number | null };
  relativeHumidity?: { value: number | null };
};
type PeriodsJson = {
  properties: { periods: RawPeriod[]; updateTime?: string };
};

const wind = (p: RawPeriod) => `${p.windDirection} ${p.windSpeed}`.trim();

/** Forecast for a place: daily periods (7 days), the next 48 hours, and where it is. */
export async function getWeather(
  lat: number,
  lon: number,
): Promise<WeatherBundle> {
  const [sLat, sLon] = snap(lat, lon);
  // Grid points move only when NWS redraws its grid; forecasts update about hourly.
  const point = await nws<PointJson>(
    `https://api.weather.gov/points/${sLat},${sLon}`,
    7 * 86400,
  );
  const p = point.properties;
  const [daily, hourly] = await Promise.all([
    nws<PeriodsJson>(p.forecast, 900),
    nws<PeriodsJson>(p.forecastHourly, 900),
  ]);
  const rel = p.relativeLocation.properties;
  const place: PlaceInfo = {
    label: `${rel.city}, ${rel.state}`,
    lat: sLat,
    lon: sLon,
    office: p.gridId,
    timeZone: p.timeZone,
    radar: p.radarStation,
  };
  return {
    place,
    daily: daily.properties.periods.map((r): Period => ({
      name: r.name,
      start: r.startTime,
      isDay: r.isDaytime,
      temp: r.temperature,
      pop: r.probabilityOfPrecipitation?.value ?? null,
      wind: wind(r),
      short: r.shortForecast,
      detail: r.detailedForecast,
    })),
    hourly: hourly.properties.periods.slice(0, 48).map((r): Hour => ({
      start: r.startTime,
      isDay: r.isDaytime,
      temp: r.temperature,
      pop: r.probabilityOfPrecipitation?.value ?? null,
      wind: wind(r),
      short: r.shortForecast,
      dewF: r.dewpoint?.value == null ? null : cToF(r.dewpoint.value),
      rh: r.relativeHumidity?.value ?? null,
    })),
    updated: daily.properties.updateTime ?? new Date().toISOString(),
  };
}

type ZipJson = {
  places: {
    "place name": string;
    "state abbreviation": string;
    latitude: string;
    longitude: string;
  }[];
};

/** ZIP code to a snapped point and a "City, ST" label. */
export async function lookupZip(zip: string) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    next: { revalidate: 30 * 86400 },
  });
  if (res.status === 404)
    throw new UpstreamError("That ZIP code was not found", 404);
  if (!res.ok) throw new UpstreamError(`ZIP lookup error ${res.status}`, 502);
  const first = ((await res.json()) as ZipJson).places[0];
  if (!first) throw new UpstreamError("That ZIP code was not found", 404);
  const [lat, lon] = snap(Number(first.latitude), Number(first.longitude));
  return {
    lat,
    lon,
    label: `${first["place name"]}, ${first["state abbreviation"]}`,
  };
}
