import "server-only";
import { gemini } from "@/lib/ai/gemini";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import {
  cleanDraft,
  DEFAULT_POINTS,
  fingerprintText,
  isDuplicate,
  parseReply,
  type Draft,
  type Past,
} from "./shape";

const SHAPE = `Return ONLY JSON: {"question":string,"choices":[string,string,string,string],"answer_index":number,"explanation":string}. answer_index is the 0-based index of the correct choice.`;

// The VIP app's prompts, kept word for word: they were tuned there.
const PROMPTS = {
  weather: (
    seed: string,
  ) => `Write ONE multiple-choice trivia question about weather or meteorology.
Make it genuinely interesting to a severe-weather enthusiast - radar, storm structure, forecasting, records, or atmospheric physics.
Avoid the most obvious textbook facts. Exactly 4 choices, only one correct. Question under 190 characters.
The explanation should be one or two sentences and teach something.
Vary the subject; variation seed ${seed}.\n${SHAPE}`,
  random: (
    seed: string,
  ) => `Write ONE multiple-choice trivia question about ANY topic EXCEPT weather or meteorology.
It must be unique, fun and specific - a surprising piece of history, science, space, nature, food, language, sport or pop culture.
Do NOT ask a generic quiz-night question (no "capital of", no "how many continents").
Aim for something that makes the reader say "huh, I did not know that".
Exactly 4 choices, only one correct. Question under 190 characters.
The explanation should be one or two sentences and genuinely interesting.
Vary the subject; variation seed ${seed}.\n${SHAPE}`,
};

export type Category = keyof typeof PROMPTS;

export const fingerprint = (question: string) =>
  createHash("sha256")
    .update(fingerprintText(question))
    .digest("hex")
    .slice(0, 32);

/** The past year's questions with their correct answers, for the duplicate guard. */
export async function pastYear(): Promise<Past[]> {
  const since = new Date(Date.now() - 366 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabaseAdmin()
    .from("trivia_questions")
    .select("question, choices, answer_index")
    .gte("ask_date", since)
    .limit(5000);
  return (data ?? []).map((r) => ({
    question: r.question,
    answer: r.choices[r.answer_index] ?? "",
  }));
}

/**
 * One fresh question from Gemini, validated and checked against the past
 * year (`past`); throws when none could be made.
 */
export async function draftQuestion(
  category: Category,
  past: Past[] = [],
): Promise<Draft> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const db = supabaseAdmin();
  const avoid = past.length
    ? `\nDo NOT repeat or rephrase any of these recent questions:\n${past
        .slice(-40)
        .map((p) => `- ${p.question}`)
        .join("\n")}`
    : "";
  // Two passes: a duplicate or a malformed reply asks again, with a fresh seed each time.
  const draft = await gemini({
    key,
    prompt: "",
    vary: () =>
      PROMPTS[category](`${Date.now()}-${Math.floor(Math.random() * 1e5)}`) +
      avoid,
    temperature: 1,
    maxOutputTokens: 1500,
    json: true,
    accept: (text) => {
      const d = cleanDraft(parseReply(text));
      return d && !isDuplicate(d, past) ? d : null;
    },
    passes: 2,
    budget: 50,
    counted: (ok) => db.rpc("count_ai_call", { p_feature: "trivia", p_ok: ok }),
  });
  if (!draft) throw new Error("Gemini didn't return a usable question");
  return draft;
}

/**
 * Makes a day's three questions (1 and 3: weather, 2: a random topic) when
 * missing (BuildPlan §6), each checked against the past year.
 * Never replaces a question that already exists, AI or admin.
 */
export async function ensureDay(day: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("trivia_questions")
    .select("slot")
    .eq("ask_date", day);
  const have = new Set((data ?? []).map((r) => r.slot));
  const made: number[] = [];
  const failed: string[] = [];
  const past = have.size >= 3 ? [] : await pastYear();
  for (const [slot, category] of [
    [1, "weather"],
    [2, "random"],
    [3, "weather"],
  ] as const) {
    if (have.has(slot)) continue;
    try {
      const q = await draftQuestion(category, past);
      past.push({ question: q.question, answer: q.choices[q.answer_index] });
      const { error } = await db.from("trivia_questions").insert({
        ask_date: day,
        slot,
        category,
        ...q,
        fingerprint: fingerprint(q.question),
        points: DEFAULT_POINTS,
        source: "ai",
      });
      if (error && error.code !== "23505") throw new Error(error.message);
      made.push(slot);
    } catch (e) {
      failed.push(`${category}: ${(e as Error).message}`);
    }
  }
  return { day, made, failed };
}

let lastTry = 0;

/** Self-heal for a missed midnight run: at most every 10 minutes per instance. */
export async function healDay(day: string) {
  if (
    Date.now() - lastTry < 10 * 60_000 ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return;
  lastTry = Date.now();
  try {
    await ensureDay(day);
  } catch (e) {
    console.error("trivia self-heal failed", e);
  }
}
