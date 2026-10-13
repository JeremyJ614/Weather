/** Normalized weather data shared by every page. Units are US (°F, mph). */
export type Period = {
  name: string;
  start: string;
  isDay: boolean;
  temp: number;
  /** Chance of precipitation, 0–100, or null when NWS gives none. */
  pop: number | null;
  wind: string;
  short: string;
  detail: string;
};

export type Hour = {
  start: string;
  isDay: boolean;
  temp: number;
  pop: number | null;
  wind: string;
  short: string;
  dewF: number | null;
  rh: number | null;
};

export type PlaceInfo = {
  label: string;
  lat: number;
  lon: number;
  office: string;
  timeZone: string;
  radar: string;
};

export type WeatherBundle = {
  place: PlaceInfo;
  daily: Period[];
  hourly: Hour[];
  updated: string;
};
