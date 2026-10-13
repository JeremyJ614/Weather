/** A trivia question as Gemini or an admin supplies it, checked before it is stored. */
export type Draft = {
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
};

export const DEFAULT_POINTS = 150; // VIP's 100 + 50
export const BONUS_POINTS = 300;

/** Validates and tidies a draft; null when it can't be a fair question. */
export function cleanDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = String(r.question ?? "").trim();
  const choices = Array.isArray(r.choices)
    ? r.choices.map((c) => String(c ?? "").trim()).filter(Boolean)
    : [];
  const answer = Number(r.answer_index);
  const explanation = String(r.explanation ?? "").trim();
  if (question.length < 8 || question.length > 300) return null;
  if (choices.length < 2 || choices.length > 6) return null;
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length)
    return null;
  if (choices.some((c) => c.length > 120)) return null;
  if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length)
    return null;
  return {
    question,
    choices,
    answer_index: answer,
    explanation: explanation.slice(0, 600),
  };
}

/** Pulls the JSON object out of a model reply (which may wrap it in a fence). */
export function parseReply(text: string): unknown {
  const s = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
