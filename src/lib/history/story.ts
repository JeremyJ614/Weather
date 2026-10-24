import "server-only";
import type { OtdData } from "./onthisday";

/**
 * On This Day's stories, written by Gemini (the owner's history key) from NOAA's records for
 * the date, plus at most three other well-documented U.S. weather events it is sure fell on
 * that date. Record items must match a year in the records, or they are dropped.
 */
export const KINDS = [
  "tornado",
  "hurricane",
  "flood",
  "winter",
  "heat",
  "cold",
  "wind",
  "hail",
  "fire",
  "other",
] as const;
export type Kind = (typeof KINDS)[number];

export type OtdEvent = {
  year: number;
  kind: Kind;
  title: string;
  text: string;
  /** "records": from NOAA's data shown on the page; "history": the wider record books. */
  from: "records" | "history";
};
export type OtdStory = { headline: string; intro: string; events: OtdEvent[] };

const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const dateName = (md: string) =>
  `${MONTHS[Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}`;

function facts(d: OtdData) {
  const t = d.tornadoes;
  const lines = [
    `Tornadoes on file for ${dateName(d.md)}, 1950 to ${d.through}: ${t.total} in ${t.years} different years, ${t.deaths} deaths in all.`,
    ...t.top.map(
      (x) =>
        `${x.year}: ${x.rating} tornado ${x.near ? `through or near ${x.near}` : `in ${x.st}`}, ${x.miles.toFixed(1)} miles long, ${x.yards} yards wide, ${x.deaths} killed, ${x.hurt} injured.`,
    ),
    ...d.landfalls
      .slice(0, 6)
      .map(
        (l) =>
          `${l.year}: ${l.name} made landfall ${l.near} as a ${l.strength.toLowerCase()} (${l.mph} mph winds).`,
      ),
  ];
  return lines.join("\n");
}

/** The model's JSON checked against the records; anything malformed is no story. */
export function cleanStory(raw: string, d: OtdData): OtdStory | null {
  let j: {
    headline?: unknown;
    intro?: unknown;
    events?: Record<string, unknown>[];
  };
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return null;
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const headline = str(j.headline, 160);
  const intro = str(j.intro, 600);
  if (!headline || !intro || !Array.isArray(j.events)) return null;
  const known = new Set([
    ...d.tornadoes.top.map((t) => t.year),
    ...d.landfalls.map((l) => l.year),
  ]);
  const now = new Date().getUTCFullYear();
  let history = 0;
  const events: OtdEvent[] = [];
  for (const e of j.events) {
    const year = Number(e.year);
    const kind = KINDS.includes(e.kind as Kind) ? (e.kind as Kind) : "other";
    const title = str(e.title, 80);
    const text = str(e.text, 320);
    const from = e.from === "records" ? "records" : "history";
    if (!Number.isInteger(year) || year < 1700 || year > now || !title || !text)
      continue;
    if (from === "records" && !known.has(year)) continue;
    if (from === "history" && ++history > 3) continue;
    events.push({ year, kind, title, text, from });
  }
  if (!events.length) return null;
  events.sort((a, b) => b.year - a.year);
  return { headline, intro, events: events.slice(0, 8) };
}

/** Writes the date's stories, or null when Gemini can't. */
export async function writeStory(d: OtdData): Promise<OtdStory | null> {
  const key = process.env.GEMINI_HISTORY_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return null;
  const prompt = `You are the SSWX Forecast Desk at StormSync Media writing "On This Day in Weather History" for ${dateName(d.md)}, for weather fans in the United States. Warm, vivid, plain words; respectful about lives lost; no jargon.

Here are NOAA's records for this date (SPC's tornado database and NHC's hurricane best tracks):
${facts(d)}

Write:
- "headline": one sentence on the most remarkable event on this date.
- "intro": two or three sentences setting the scene for the date.
- "events": 4 to 8 events, each {"year": number, "kind": one of ${KINDS.join(", ")}, "title": under 60 characters, "text": two sentences under 240 characters, "from": "records" or "history"}.
Events marked "records" must come from the records above, using only their numbers and places. You may add up to 3 events marked "history": other famous U.S. weather events (blizzards, floods, heat waves, cold outbreaks, derechos, hailstorms, wildfires) that you are certain happened on ${dateName(d.md)} of that year. If you are not certain of the exact date, leave it out. Never invent numbers.

Answer with JSON only: {"headline": string, "intro": string, "events": [...]}`;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2000,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const out = res.ok ? await res.json() : null;
      const text: string =
        out?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      const s = cleanStory(text, d);
      if (s) return s;
    } catch {
      // overloaded or timed out: try the next model
    }
  }
  return null;
}
