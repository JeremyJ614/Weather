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

const STOP = new Set(
  "a an the of in on at to for from by with and or is are was were be been which what who whom whose when where why how this that these those it its as into than then most more do does did can could would should has have had about over under".split(
    " ",
  ),
);

/** A question's content words: lowercase, no punctuation or filler words. */
export function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

/** Stable fingerprint: the sorted content words (hashed by the caller). */
export const fingerprintText = (question: string) =>
  [...words(question)].sort().join(" ");

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export type Past = { question: string; answer: string };

/**
 * True when a draft repeats a past question: the same wording, mostly the same
 * words, or the same correct answer asked in similar words.
 */
export function isDuplicate(d: Draft, past: Past[]): boolean {
  const q = words(d.question);
  const ans = d.choices[d.answer_index].toLowerCase().trim();
  return past.some((p) => {
    const sim = jaccard(q, words(p.question));
    return sim >= 0.55 || (sim >= 0.3 && p.answer.toLowerCase().trim() === ans);
  });
}
