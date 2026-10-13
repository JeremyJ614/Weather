import "server-only";
import { snap } from "./geo";
import { pressureTrend, spcAt, uvNow, type Trend } from "./conditions-math";

const HEADERS = {
  "User-Agent": "StormSync Weather (https://weather.sswx.space)",
  Accept: "application/geo+json",
};
const get = async <T>(
  url: string,
  revalidate: number,
  headers: HeadersInit = HEADERS,
): Promise<T | null> => {
  try {
    const r = await fetch(url, {
      headers,
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

type Q = { value: number | null };
type ObsJson = {
  features: {
    properties: {
      timestamp: string;
      temperature: Q;
      dewpoint: Q;
      relativeHumidity: Q;
      windSpeed: Q;
      windGust: Q;
      windDirection: Q;
      barometricPressure: Q;
      heatIndex: Q;
      windChill: Q;
    };
  }[];
};

const f = (c: number | null) =>
  c == null ? null : Math.round((c * 9) / 5 + 32);
const mph = (kmh: number | null) =>
  kmh == null ? null : Math.round(kmh / 1.609);

export type Conditions = {
  station: string | null;
  observed: string | null;
  tempF: number | null;
  feelsF: number | null;
  dewF: number | null;
  rh: number | null;
  windMph: number | null;
  gustMph: number | null;
  windDir: number | null;
  pressureMb: number | null;
  trend: { trend: Trend; change: number } | null;
  spc: string | null;
  uv: { now: number; max: number } | null;
};

export async function getConditions(
  lat: number,
  lon: number,
): Promise<Conditions> {
  const [sLat, sLon] = snap(lat, lon);
  const point = await get<{
    properties: {
      observationStations: string;
      timeZone: string;
      relativeLocation: { properties: { city: string; state: string } };
    };
  }>(`https://api.weather.gov/points/${sLat},${sLon}`, 7 * 86400);
  const stations = point
    ? await get<{ features: { properties: { stationIdentifier: string } }[] }>(
        `${point.properties.observationStations}?limit=3`,
        86400,
      )
    : null;
  const ids = (stations?.features ?? []).map(
    (s) => s.properties.stationIdentifier,
  );
  const rel = point?.properties.relativeLocation.properties;
  const localHour = point
    ? Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: point.properties.timeZone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date()),
      )
    : -1;

  const [obsList, spc, uv] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        get<ObsJson>(
          `https://api.weather.gov/stations/${id}/observations?limit=8`,
          600,
        ),
      ),
    ),
    get<{ features: Parameters<typeof spcAt>[2] }>(
      "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
      900,
      { "User-Agent": HEADERS["User-Agent"] },
    ),
    rel
      ? get<{ DATE_TIME: string; UV_VALUE: number }[]>(
          `https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/CITY/${encodeURIComponent(rel.city)}/STATE/${rel.state}/JSON`,
          3600,
          {},
        )
      : null,
  ]);

  // Stations differ in which sensors they have: take each reading from the nearest station
  // that reported it in the last two hours.
  type Props = ObsJson["features"][number]["properties"];
  const recent = (o: ObsJson | null) =>
    (o?.features ?? [])
      .map((x) => x.properties)
      .filter((p) => Date.now() - Date.parse(p.timestamp) < 2 * 3600000);
  const perStation = obsList.map((o, i) => ({
    id: ids[i],
    obs: recent(o),
    all: (o?.features ?? []).map((x) => x.properties),
  }));
  const pick = (k: keyof Omit<Props, "timestamp">) => {
    for (const s of perStation) {
      const hit = s.obs.find((p) => p[k].value != null);
      if (hit)
        return {
          value: hit[k].value as number,
          station: s.id,
          at: hit.timestamp,
        };
    }
    return null;
  };
  const temp = pick("temperature");
  const pressure = pick("barometricPressure");
  const pressureStation = perStation.find((s) => s.id === pressure?.station);
  const feels =
    pick("heatIndex")?.value ?? pick("windChill")?.value ?? temp?.value ?? null;
  const rh = pick("relativeHumidity")?.value;
  return {
    station: temp?.station ?? ids[0] ?? null,
    observed: temp?.at ?? null,
    tempF: f(temp?.value ?? null),
    feelsF: f(feels),
    dewF: f(pick("dewpoint")?.value ?? null),
    rh: rh == null ? null : Math.round(rh),
    windMph: mph(pick("windSpeed")?.value ?? null),
    gustMph: mph(pick("windGust")?.value ?? null),
    windDir: pick("windDirection")?.value ?? null,
    pressureMb: pressure ? Math.round(pressure.value / 10) / 10 : null,
    trend: pressureStation
      ? pressureTrend(
          pressureStation.all.map((p) => ({
            at: p.timestamp,
            hpa:
              p.barometricPressure.value == null
                ? null
                : p.barometricPressure.value / 100,
          })),
        )
      : null,
    spc: spc ? spcAt(sLon, sLat, spc.features) : null,
    uv: uv && Array.isArray(uv) ? uvNow(uv, localHour) : null,
  };
}
