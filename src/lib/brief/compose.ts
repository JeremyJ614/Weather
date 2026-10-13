import type { Hour, Period } from "@/lib/weather/types";

/** The Daily Brief's content. Built from the shared data layer; pure parts are tested. */
export type Brief = {
  place: string;
  timeZone: string;
  date: string;
  today: {
    name: string;
    short: string;
    detail: string;
    high: number | null;
    low: number | null;
  } | null;
  tomorrow: { short: string; high: number | null; low: number | null } | null;
  rain: { startsAt: string | null; peakPop: number };
  spc: string | null;
  alerts: { event: string; headline: string; ends: string | null }[];
};

/** First hour in the next 24 with at least a 40% chance of rain, and the highest chance. */
export function rainTiming(hours: Hour[]): Brief["rain"] {
  const next = hours.slice(0, 24);
  const first = next.find((h) => (h.pop ?? 0) >= 40);
  return {
    startsAt: first?.start ?? null,
    peakPop: Math.max(0, ...next.map((h) => h.pop ?? 0)),
  };
}

/**
 * Today's and tomorrow's highs and lows, matched by each period's local date (NWS start times
 * carry the local offset), so "Overnight" at 2 AM doesn't push today's daytime into tomorrow.
 */
export function dayParts(daily: Period[], localDate: string) {
  const dateOf = (p: Period) => p.start.slice(0, 10);
  const dayOn = daily.find((p) => p.isDay && dateOf(p) === localDate);
  const nightOn = daily.find(
    (p) =>
      !p.isDay && dateOf(p) === localDate && (!dayOn || p.start > dayOn.start),
  );
  const lead = dayOn ?? daily[0];
  const today = lead
    ? {
        name: lead.name,
        short: lead.short,
        detail: lead.detail,
        high: dayOn?.temp ?? null,
        low: nightOn?.temp ?? (lead.isDay ? null : lead.temp),
      }
    : null;
  const next = daily.find((p) => p.isDay && dateOf(p) > localDate);
  const nextNight = next
    ? daily.find((p) => !p.isDay && p.start > next.start)
    : undefined;
  const tomorrow = next
    ? { short: next.short, high: next.temp, low: nextNight?.temp ?? null }
    : null;
  return { today, tomorrow };
}

const SPC_WORDS: Record<string, string> = {
  TSTM: "general thunderstorms",
  MRGL: "a Marginal (1 of 5) severe risk",
  SLGT: "a Slight (2 of 5) severe risk",
  ENH: "an Enhanced (3 of 5) severe risk",
  MDT: "a Moderate (4 of 5) severe risk",
  HIGH: "a High (5 of 5) severe risk",
};

export function timeIn(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

/** Plain text, for email and as the source of the push message. */
export function briefText(b: Brief): {
  subject: string;
  lines: string[];
  push: string;
} {
  const lines: string[] = [];
  if (b.alerts.length)
    lines.push(`⚠ Active: ${b.alerts.map((a) => a.event).join(", ")}.`);
  if (b.today) {
    const hl = [
      b.today.high != null ? `high ${b.today.high}°` : null,
      b.today.low != null ? `low ${b.today.low}°` : null,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`${b.today.name}: ${b.today.short}${hl ? ` (${hl})` : ""}.`);
  }
  lines.push(
    b.rain.startsAt
      ? `Rain likely from about ${timeIn(b.rain.startsAt, b.timeZone)} (up to ${b.rain.peakPop}%).`
      : b.rain.peakPop
        ? `Low rain chances (up to ${b.rain.peakPop}%).`
        : "No rain expected in the next 24 hours.",
  );
  lines.push(
    b.spc
      ? `SPC: ${SPC_WORDS[b.spc] ?? b.spc} today.`
      : "No severe weather risk from SPC today.",
  );
  if (b.tomorrow)
    lines.push(
      `Tomorrow: ${b.tomorrow.short}, ${b.tomorrow.high ?? "–"}° / ${b.tomorrow.low ?? "–"}°.`,
    );
  const subject = `${b.alerts.length ? "⚠ " : ""}Your StormSync brief for ${b.place}`;
  const push = [
    b.alerts.length ? `⚠ ${b.alerts[0].event}` : null,
    b.today
      ? `${b.today.short}${b.today.high != null ? `, ${b.today.high}°` : ""}`
      : null,
    b.rain.startsAt ? `rain ~${timeIn(b.rain.startsAt, b.timeZone)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { subject, lines, push: push || "Your daily brief is ready" };
}

/** Is a subscription due now? Local hour matches and it hasn't gone out today. */
export function isDue(
  sub: { send_hour: number; time_zone: string; last_sent: string | null },
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: sub.time_zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    due: Number(get("hour")) === sub.send_hour && sub.last_sent !== localDate,
    localDate,
  };
}
