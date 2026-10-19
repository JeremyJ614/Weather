/** Badge rarities (with their default colors, editable in Map & data colors) and icons. */
export const RARITY: Record<string, string> = {
  common: "#9aa3b8",
  rare: "#4cc9f0",
  epic: "#a78bfa",
  legendary: "#ffb547",
};
export const RARITIES = Object.keys(RARITY) as (keyof typeof RARITY)[];
export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  grp: string;
  /** Set on badges that are earned automatically (award_badges() in the database). */
  rule_metric?: string | null;
  rule_goal?: number | null;
  auto_key?: string | null;
};

/** What each automatic rule counts, as the progress bar says it. */
const UNITS: Record<string, [one: string, many: string]> = {
  days: ["day", "days"],
  streak: ["day in a row", "days in a row"],
  pages: ["page", "pages"],
  guesses: ["forecast", "forecasts"],
  points: ["point", "points"],
  titles: ["title", "titles"],
  trivia: ["right answer", "right answers"],
  votes: ["vote", "votes"],
  chases: ["chase", "chases"],
  tornadoes: ["tornado", "tornadoes"],
  miles: ["mile", "miles"],
  referrals: ["friend", "friends"],
  member_days: ["day", "days"],
};

/** "3 of 7 days in a row", or null for a yes/no rule (alerts on, a paid plan…). */
export function progressText(metric: string, value: number, goal: number) {
  const u = metric.startsWith("page:") ? UNITS.days : UNITS[metric];
  if (!u || goal <= 1) return null;
  return `${Math.min(value, goal).toLocaleString("en-US")} of ${goal.toLocaleString("en-US")} ${goal === 1 ? u[0] : u[1]}`;
}

/** What each rule counts, for the admin badge editor. Yes/no rules have a goal of 1. */
export const METRIC_NAMES: Record<string, string> = {
  days: "Days they opened the app",
  streak: "Days in a row",
  pages: "Different pages visited",
  guesses: "Forecasts made in the Wx Game",
  points: "Game points",
  titles: "Game titles won",
  trivia: "Trivia answers right",
  votes: "Poll votes",
  chases: "Chases logged",
  tornadoes: "Tornadoes in logged chases",
  miles: "Miles of logged chases",
  referrals: "Friends referred",
  member_days: "Days as a member",
  founding: "Joined in 2026 (yes/no)",
  alerts: "Alerts turned on (yes/no)",
  push: "Push alerts on a device (yes/no)",
  brief: "Signed up for the Daily Brief (yes/no)",
  paid: "On a paid plan (yes/no)",
  yearly: "On a yearly plan (yes/no)",
};
export const metricName = (m: string) =>
  m.startsWith("page:") ? `Days on /${m.slice(5)}` : (METRIC_NAMES[m] ?? m);
