/** Every alert a member can turn on in the Notifications center (Phase 63). Client-safe. */
export type TopicId =
  | "warnings"
  | "watches"
  | "spc"
  | "engines"
  | "surge"
  | "rainbow"
  | "news"
  | "tropical"
  | "aurora"
  | "game"
  | "trivia"
  | "polls";

export type Topic = {
  id: TopicId;
  group: string;
  label: string;
  note: string;
  /** Comes through during quiet hours. */
  urgent?: boolean;
  /** Needs the member's place. */
  local?: boolean;
};

export const TOPICS: Topic[] = [
  {
    id: "warnings",
    group: "Severe weather",
    label: "Warnings",
    note: "Tornado, severe thunderstorm, flash flood and every other NWS warning for your place.",
    urgent: true,
    local: true,
  },
  {
    id: "watches",
    group: "Severe weather",
    label: "Watches",
    note: "Tornado and severe thunderstorm watches, and other NWS watches, for your place.",
    urgent: true,
    local: true,
  },
  {
    id: "spc",
    group: "Severe weather",
    label: "SPC upgrades",
    note: "When SPC's Day 1 outlook puts your place in a risk, and again each time it's raised.",
    local: true,
  },
  {
    id: "engines",
    group: "StormSync",
    label: "Engine alerts",
    note: "When our SSWXCon national score reaches Significant or higher, and each step up that day.",
  },
  {
    id: "surge",
    group: "StormSync",
    label: "Lightning surges",
    note: "Experimental: when a storm within 25 miles of your place has a lightning jump, which often comes 10 to 20 minutes before severe weather.",
    local: true,
  },
  {
    id: "rainbow",
    group: "Tropics & sky",
    label: "Rainbow chances",
    note: "Experimental: when the sun is low, rain is close by and a rainbow could be in view from your place, with which way to look.",
    local: true,
  },
  {
    id: "news",
    group: "StormSync",
    label: "SSWX News",
    note: "New StormSync News stories and announcements from the team.",
  },
  {
    id: "tropical",
    group: "Tropics & sky",
    label: "Tropical updates",
    note: "Each new depression or named storm, and each change in strength, from the NHC.",
  },
  {
    id: "aurora",
    group: "Tropics & sky",
    label: "Aurora alerts",
    note: "When the Kp forecast says the aurora could be seen from your place.",
    local: true,
  },
  {
    id: "game",
    group: "Games & community",
    label: "Game results",
    note: "Your points when the forecast game is scored.",
  },
  {
    id: "trivia",
    group: "Games & community",
    label: "New trivia",
    note: "When today's trivia questions are ready.",
  },
  {
    id: "polls",
    group: "Games & community",
    label: "New polls",
    note: "When a new weekly poll opens.",
  },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const isTopic = (v: unknown): v is TopicId =>
  typeof v === "string" && (TOPIC_IDS as string[]).includes(v);
export const topicOf = (id: string) => TOPICS.find((t) => t.id === id);

/**
 * Whether the hour in the member's time zone falls in their quiet hours (from–to, wrapping
 * past midnight). No quiet hours set means never quiet.
 */
export function isQuiet(
  q: {
    quiet_from: number | null;
    quiet_to: number | null;
    time_zone: string | null;
  },
  now: Date,
) {
  if (q.quiet_from == null || q.quiet_to == null || q.quiet_from === q.quiet_to)
    return false;
  let h: number;
  try {
    h = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: q.time_zone || "America/New_York",
      }).format(now),
    );
  } catch {
    h = now.getUTCHours();
  }
  return q.quiet_from < q.quiet_to
    ? h >= q.quiet_from && h < q.quiet_to
    : h >= q.quiet_from || h < q.quiet_to;
}
