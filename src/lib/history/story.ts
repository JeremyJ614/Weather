import "server-only";
import { gemini } from "@/lib/ai/gemini";
import type { OtdFeature } from "./onthisday";
import type { Article, Photo } from "./wiki";

/**
 * On This Day's write-up of the featured event, by Gemini (the owner's history key), in a
 * person's voice: a weather writer telling the story, not a list of numbers. It may use only
 * NOAA's facts and the Wikipedia article about the event; anything else is left out.
 */
export type OtdStory = {
  /** The event's name, e.g. "The Jarrell Tornado". */
  title: string;
  headline: string;
  /** Three to five paragraphs. */
  story: string[];
  photos: Photo[];
  source: { title: string; url: string } | null;
  /** When it was written; `retry` when Wikipedia didn't answer and it should be redone. */
  written?: string;
  retry?: boolean;
};

const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );
export const dateName = (md: string) =>
  `${MONTHS[Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}`;

/** Phrases that make writing sound machine-made; a draft with them is sent back. */
const TELLS = [
  /\bin conclusion\b/i,
  /\btestament to\b/i,
  /\bdelve\b/i,
  /\btapestry\b/i,
  /\b(serves as |is |was |remains )?an? (stark|sobering|poignant|grim|powerful) reminder\b/i,
  /\bserves as a reminder\b/i,
  /\bforever (changed|etched)\b/i,
  /\bnature'?s (fury|wrath)\b/i,
  /\bstands as a\b/i,
  /\bit is (important|worth) (to note|noting)\b/i,
  /\bin the annals\b/i,
  /\bnavigat(e|ing) the\b/i,
  /^#|\n#|\*\*|^\s*[-•]/m,
];

/** The model's JSON, checked: the right shape, sensible lengths, no machine tells. */
export function cleanFeature(
  raw: string,
): Pick<OtdStory, "title" | "headline" | "story"> | null {
  let j: { title?: unknown; headline?: unknown; story?: unknown };
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return null;
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const title = str(j.title, 70);
  const headline = str(j.headline, 220);
  const paras = (Array.isArray(j.story) ? j.story : []).map((p) => str(p, 900));
  // Machine tells anywhere (even in a stray short line) send the draft back.
  if (TELLS.some((re) => re.test([title, headline, ...paras].join("\n"))))
    return null;
  const story = paras.filter((p) => p.length >= 60);
  if (!title || !headline || story.length < 3 || story.length > 6) return null;
  return { title, headline, story };
}

/** Writes the featured event's story, or null when Gemini can't (the page then uses NOAA's facts). */
export async function writeFeature(
  f: OtdFeature,
  md: string,
  article: Article | null,
): Promise<Pick<OtdStory, "title" | "headline" | "story"> | null> {
  const key = process.env.GEMINI_HISTORY_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return null;
  const when = `${dateName(md)}, ${f.year}`;
  const prompt = `You write the "On This Day" feature for StormSync Media, a weather site for storm chasers and weather fans in the United States. Today's feature is what happened on ${when}.

Write it the way a seasoned weather writer and storm chaser would tell it to a friend who loves weather: warm, vivid and human. Put the reader in that day: the sky, the towns, the timing, what people saw and did, and what forecasters learned. Vary your sentence lengths. Use only a few numbers, where they matter. Be respectful and gentle about people who were killed or hurt. Plain words, no jargon unless you explain it in passing.

Do not sound like an AI or a report: no lists, no headings, no bold, no "In conclusion", no "testament to", "delve", "tapestry", "stands as", "a stark reminder", "nature's fury", "forever changed", "it is worth noting".

Use ONLY the facts below. If something is not in them, leave it out: never invent a name, a quote, a number, a time or a detail.

NOAA's records:
${f.facts.join("\n")}
${article ? `\nFrom the Wikipedia article "${article.title}":\n${article.text}\n` : ""}
Answer with JSON only:
{"title": "the event's name as people know it, or a plain one (under 60 characters)", "headline": "one sentence that draws the reader in (under 200 characters)", "story": ["3 to 5 paragraphs, each 2 to 4 sentences"]}`;
  // Two passes: a draft with a machine tell is sent back for another try.
  return gemini({
    key,
    prompt,
    temperature: 0.8,
    maxOutputTokens: 2500,
    json: true,
    accept: cleanFeature,
    passes: 2,
    budget: 50,
  });
}
