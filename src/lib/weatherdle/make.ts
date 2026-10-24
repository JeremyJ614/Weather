import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkWord, WORDS, type WordPick } from "./words";

/**
 * Today's Weatherdle word: Gemini picks a weather or severe-weather word of any length (with
 * a hint) that hasn't been used in the past year; if it can't, the next unused word from
 * our own list. An admin's word for the day always stands.
 */
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

async function fromGemini(used: Set<string>): Promise<WordPick | null> {
  const key = process.env.GEMINI_WEATHERDLE_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) return null;
  const recent = [...used].slice(-120).join(", ");
  const prompt = `Pick today's word for Weatherdle, a daily word-guessing game for weather fans (like Wordle, but the word can be any length). Choose ONE real word about weather, severe weather, storms, clouds, forecasting, the atmosphere or climate, between 4 and 12 letters, written as one word with no spaces or hyphens (for example TORNADO, MESOCYCLONE, HABOOB, GRAUPEL). Vary it: sometimes easy, sometimes a word a storm chaser would know. Do not use any of these recent words: ${recent || "none"}.
Also write a one-sentence hint, under 120 characters, that helps without naming the word or any form of it.
Answer with JSON only: {"word": string, "hint": string}`;
  for (const model of MODELS) {
    let ok = false;
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
              temperature: 1,
              maxOutputTokens: 200,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const out = res.ok ? await res.json() : null;
      const text: string =
        out?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") ?? "";
      const j = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
      const pick = checkWord(j.word, j.hint);
      if (
        pick &&
        pick.word.length >= 4 &&
        pick.word.length <= 12 &&
        !used.has(pick.word)
      ) {
        ok = true;
        return pick;
      }
    } catch {
      // overloaded, timed out or not JSON: try the next model, then our list
    } finally {
      await supabaseAdmin()
        .rpc("count_ai_call", { p_feature: "weatherdle", p_ok: ok })
        .then(() => undefined);
    }
  }
  return null;
}

/** The first word of our list not used in the past year, rotating by date. */
export function fromList(day: string, used: Set<string>): WordPick {
  const start =
    Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400_000) % WORDS.length;
  for (let k = 0; k < WORDS.length; k++) {
    const w = WORDS[(start + k) % WORDS.length];
    if (!used.has(w.word)) return w;
  }
  return WORDS[start];
}

/** Makes the word for `day` (YYYY-MM-DD, Eastern) unless one is already set. */
export async function ensureWord(day: string) {
  const db = supabaseAdmin();
  const { data: have } = await db
    .from("weatherdle_words")
    .select("word, source")
    .eq("day", day)
    .maybeSingle();
  if (have) return { day, made: false, source: have.source as string };
  const since = new Date(Date.parse(`${day}T12:00:00Z`) - 366 * 86400_000)
    .toISOString()
    .slice(0, 10);
  const { data: past } = await db
    .from("weatherdle_words")
    .select("word")
    .gte("day", since)
    .order("day");
  const used = new Set((past ?? []).map((r: { word: string }) => r.word));
  const ai = await fromGemini(used);
  const pick = ai ?? fromList(day, used);
  // Ignore a race with the scheduler or an admin: whoever wrote first stands.
  const { error } = await db
    .from("weatherdle_words")
    .upsert(
      { day, ...pick, source: ai ? "ai" : "list" },
      { onConflict: "day", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  return { day, made: true, source: ai ? "ai" : "list" };
}

let lastTry = 0;
/** A page visit that finds no word today makes one (at most every few minutes). */
export async function healWord(day: string) {
  if (
    Date.now() - lastTry < 5 * 60_000 ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return;
  lastTry = Date.now();
  try {
    await ensureWord(day);
  } catch (e) {
    console.error("weatherdle self-heal failed", e);
  }
}
