import { windMph } from "./scales";
import type { Hour } from "@/lib/weather/types";

/**
 * Mosquito activity index (0–100), ported from the VIP app. Four terms that
 * add up: warmth (peaks near 80°F, nothing below 50 or above 95), humidity
 * (above 40%), water (VIP used measured rain; NWS gives the chance of rain,
 * so the chance stands in for it), and wind (they are weak fliers). The terms
 * are kept so the page can say which one is holding the number down. The sum
 * is then scaled by the place's own season (`mosquitoSeason`, Fix It List #35, 7):
 * a warm November afternoon after a hard freeze is not a mosquito day.
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
  /** The weather's score scaled by the local season. */
  score: number;
  /** The weather alone, before the season. */
  raw: number;
  parts: MosquitoParts;
  tempF: number;
  rh: number;
  wind: number;
};

/**
 * Scores every hour; missing humidity falls back to 60% (NWS hourly almost always has it).
 * `season` is the local season's factor (1 = full season).
 */
export function mosquitoHours(
  hours: Hour[],
  timeZone: string,
  season = 1,
): MosquitoHour[] {
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
      score: Math.round(score * season),
      raw: score,
      parts,
      tempF: h.temp,
      rh,
      wind,
    };
  });
}

/** One day's high and low (°F) at the place, oldest first. */
export type MosquitoDay = { date: string; max: number; min: number };
export type MosquitoSeason = {
  /** 0 (off season) to 1 (full season): what the weather's score is multiplied by. */
  factor: number;
  label: string;
  why: string;
  /** The last two weeks' average temperature, °F. */
  warmth: number | null;
  /** "local": the place's own last 30 days; "forecast": only the next two days were known. */
  from: "local" | "forecast";
};

const HARD_FREEZE = 28;
const FROST = 32;
/** Daily mean temperatures (°F) at which mosquito life stops and runs at full speed. */
const COLD = 45;
const WARM = 65;

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Where the place is in its own mosquito season (Fix It List #35, 7: the index ignored
 * the season, so a mild November day read like July). From the place's last 30 days:
 *
 * - Warmth: mosquitoes develop and fly freely only after a run of warm days. The last two
 *   weeks' average temperature sets the factor, nothing at 45°F or below, full at 65°F or
 *   above. This alone gives Miami a year round season and Minneapolis a short summer one.
 * - Freezes: in late summer and fall a hard freeze (28°F or colder) kills the adults and
 *   sends the rest into their winter rest, which ends the year's season whatever the
 *   afternoons do after it; a lighter frost halves it. In winter and spring a freeze only
 *   sets them back, and they recover over the next month.
 *
 * Without the place's history (outside the lower 48, or the source is down) the next two
 * days of the forecast stand in, which is rougher and says so.
 */
export function mosquitoSeason(
  days: MosquitoDay[],
  lat: number,
  today: Date,
  hours: Hour[] = [],
): MosquitoSeason {
  const ok = days.filter(
    (d) => Number.isFinite(d.max) && Number.isFinite(d.min) && d.max >= d.min,
  );
  const local = ok.length >= 7;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  let warmth: number | null = null;
  if (local) warmth = mean(ok.slice(-14).map((d) => (d.max + d.min) / 2));
  else if (hours.length) warmth = mean(hours.slice(0, 48).map((h) => h.temp));
  const fromWarmth =
    warmth == null
      ? 1
      : Math.max(0, Math.min(1, (warmth - COLD) / (WARM - COLD)));

  // Late summer and fall: August to December in the north, February to June in the south.
  const m = today.getUTCMonth();
  const fall = lat >= 0 ? m >= 7 : m >= 1 && m <= 5;
  const last = (limit: number) =>
    [...ok].reverse().find((d) => d.min <= limit) ?? null;
  const hard = last(HARD_FREEZE);
  const frost = last(FROST);
  const ago = (d: MosquitoDay) =>
    Math.max(
      0,
      Math.round(
        (today.getTime() - Date.parse(`${d.date}T12:00:00Z`)) / 86400_000,
      ),
    );
  let fromFreeze = 1;
  let freezeWhy = "";
  if (fall && hard) {
    fromFreeze = 0.1;
    freezeWhy = `A hard freeze on ${dayName(hard.date)} (${hard.min}°F) ended most mosquito activity for the year; the few left are slow and sheltering.`;
  } else if (fall && frost) {
    fromFreeze = 0.5;
    freezeWhy = `A frost on ${dayName(frost.date)} (${frost.min}°F) killed many of the adults, so activity runs about half of what the weather alone suggests.`;
  } else if (!fall && hard && ago(hard) < 30) {
    fromFreeze = 0.3 + 0.7 * (ago(hard) / 30);
    freezeWhy = `A hard freeze on ${dayName(hard.date)} (${hard.min}°F) set them back, and numbers are still recovering.`;
  }

  const factor = Math.round(Math.min(fromWarmth, fromFreeze) * 100) / 100;
  const w = warmth == null ? null : Math.round(warmth);
  const warmWhy =
    w == null
      ? "There is no recent temperature record here, so the weather alone sets the index."
      : !local
        ? `There is no temperature record for the last month here, so the next two days (about ${w}°F on average) stand in for the season.`
        : fromWarmth >= 0.9
          ? `The last two weeks averaged ${w}°F here, warm enough for ${fromWarmth >= 1 ? "a full" : "close to a full"} mosquito season.`
          : fromWarmth <= 0
            ? `The last two weeks averaged ${w}°F here. Below about ${COLD}°F mosquitoes don't develop or fly.`
            : `The last two weeks averaged ${w}°F here. Mosquitoes need days averaging ${WARM}°F or warmer to be fully active, so they are only partly so.`;
  const label =
    factor >= 0.9
      ? w != null && w >= 74
        ? "Peak season"
        : "In season"
      : factor >= 0.5
        ? fall
          ? "Winding down"
          : "Building"
        : factor >= 0.15
          ? fall
            ? "Late season"
            : "Waking up"
          : "Off season";
  return {
    factor,
    label,
    why: fromFreeze < fromWarmth ? freezeWhy : warmWhy,
    warmth: w,
    from: local ? "local" : "forecast",
  };
}
