import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanDraft, DEFAULT_POINTS, parseReply, type Draft } from "./shape";

// "latest" aliases (pinned names retire); the lite model answers when flash is overloaded.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
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

/** One fresh question from Gemini, validated; throws when none could be made. */
export async function draftQuestion(category: Category): Promise<Draft> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const db = supabaseAdmin();
  for (const model of MODELS) {
    let ok = false;
    try {
      const seed = `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPTS[category](seed) }] }],
            generationConfig: {
              temperature: 1,
              responseMimeType: "application/json",
              maxOutputTokens: 1500,
            },
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      const out = res.ok ? await res.json() : null;
      const text: string =
        out?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      const draft = cleanDraft(parseReply(text));
      if (draft) {
        ok = true;
        return draft;
      }
    } catch {
      // overloaded or timed out: try the next model
    } finally {
      await db.rpc("count_ai_call", { p_feature: "trivia", p_ok: ok });
    }
  }
  throw new Error("Gemini didn't return a usable question");
}

/**
 * Makes a day's two questions (1: weather, 2: a random topic) when missing.
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
  for (const [slot, category] of [
    [1, "weather"],
    [2, "random"],
  ] as const) {
    if (have.has(slot)) continue;
    try {
      const q = await draftQuestion(category);
      const { error } = await db.from("trivia_questions").insert({
        ask_date: day,
        slot,
        category,
        ...q,
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
