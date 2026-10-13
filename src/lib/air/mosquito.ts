import { windMph } from "./scales";
import type { Hour } from "@/lib/weather/types";

/**
 * Mosquito activity index (0–100), ported from the VIP app. Four terms that
 * add up: warmth (peaks near 80°F, nothing below 50 or above 95), humidity
 * (above 40%), water (VIP used measured rain; NWS gives the chance of rain,
 * so the chance stands in for it), and wind (they are weak fliers). The terms
 * are kept so the page can say which one is holding the number down.
 */
export type MosquitoParts = {
  temp: number;
  humidity: number;
  water: number;
  wind: number;
};
export type MosquitoScore = { score: number; parts: MosquitoParts };

export function mosquitoScore(
  tempF: number,
  humidity: number,
  rainChance: number,
  wind: number,
): MosquitoScore {
  const parts: MosquitoParts = { temp: 0, humidity: 0, water: 0, wind: 0 };
  if (tempF >= 50 && tempF <= 95)
    parts.temp = (1 - Math.abs(tempF - 80) / 45) * 40;
  if (humidity >= 40) parts.humidity = Math.min(30, (humidity - 40) * 0.6);
  parts.water = rainChance >= 20 ? Math.min(20, 5 + rainChance * 0.15) : 5;
  if (wind < 5) parts.wind = 10;
  else if (wind < 10) parts.wind = 5;
  else if (wind > 15) parts.wind = -10;
  const total = parts.temp + parts.humidity + parts.water + parts.wind;
  return { score: Math.max(0, Math.min(100, Math.round(total))), parts };
}

export const MOSQUITO_BANDS = [
  {
    min: 80,
    label: "Very high",
    color: "#ff5257",
    advice: "Extreme activity. Repellent and covered skin, not a choice.",
  },
  {
    min: 60,
    label: "High",
    color: "#ff8a3d",
    advice: "High activity. Protection strongly recommended.",
  },
  {
    min: 40,
    label: "Moderate",
    color: "#e8cc4d",
    advice: "Moderate activity. Worth repellent at dawn and dusk.",
  },
  {
    min: 20,
    label: "Low",
    color: "#9ed94f",
    advice: "Low activity. Conditions are mostly against them.",
  },
  {
    min: 0,
    label: "Very low",
    color: "#5fd9a8",
    advice: "Minimal to no activity expected.",
  },
] as const;

export const mosquitoBand = (score: number) =>
  MOSQUITO_BANDS.find((b) => score >= b.min) ?? MOSQUITO_BANDS[4];

export type MosquitoHour = {
  at: string;
  hour: number;
  score: number;
  parts: MosquitoParts;
  tempF: number;
  rh: number;
  wind: number;
};

/** Scores every hour; missing humidity falls back to 60% (NWS hourly almost always has it). */
export function mosquitoHours(hours: Hour[], timeZone: string): MosquitoHour[] {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  });
  return hours.map((h) => {
    const rh = h.rh ?? 60;
    const wind = windMph(h.wind);
    const { score, parts } = mosquitoScore(h.temp, rh, h.pop ?? 0, wind);
    return {
      at: h.start,
      hour: Number(fmt.format(new Date(h.start))),
      score,
      parts,
      tempF: h.temp,
      rh,
      wind,
    };
  });
}
