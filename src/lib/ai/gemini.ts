import "server-only";

/**
 * Every Gemini call the site makes goes through here (Fix it List #40, 1). Google moved the
 * `gemini-flash-latest` alias to a "thinking" model that spends most of a small answer budget
 * thinking (the Weather Patterns recaps came back cut off mid-JSON) and takes 20 to 150
 * seconds when it isn't overloaded. So the models are named exactly and tried in order: the
 * fast Flash-Lite models first (they don't think, and answer in a second or two), the
 * `-latest` alias in case a pinned name is retired, then Flash with thinking switched off.
 * A busy model (429 or 503) or a reply the caller can't use moves straight on to the next.
 */
type Rung = {
  model: string;
  /** Seconds to wait for this model before moving on. */
  wait: number;
  /** Model-specific settings (each family accepts different thinking options). */
  config?: Record<string, unknown>;
};

export const LADDER: Rung[] = [
  { model: "gemini-3.5-flash-lite", wait: 15 },
  { model: "gemini-3.1-flash-lite", wait: 15 },
  { model: "gemini-flash-lite-latest", wait: 15 },
  {
    model: "gemini-3.5-flash",
    wait: 25,
    config: { thinkingConfig: { thinkingBudget: 0 } },
  },
];

export type GeminiCall<T> = {
  key: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  /** Ask for JSON (responseMimeType application/json). */
  json?: boolean;
  /** The reply as the caller wants it, or null to try the next model. */
  accept: (text: string) => T | null;
  /** Times through the ladder (a second pass helps when every model was busy). */
  passes?: number;
  /** The whole call's time limit in seconds (keep it under the route's maxDuration). */
  budget?: number;
  /** Hears every attempt (the AI usage counter). */
  counted?: (ok: boolean) => unknown;
  /** Different words for each attempt (trivia asks again for a fresh question). */
  vary?: (attempt: number) => string;
};

/** The first usable reply down the ladder, or null when none came within the budget. */
export async function gemini<T>(c: GeminiCall<T>): Promise<T | null> {
  const end = Date.now() + (c.budget ?? 50) * 1000;
  const retired = new Set<string>();
  let attempt = 0;
  for (let pass = 0; pass < (c.passes ?? 1); pass++) {
    for (const rung of LADDER) {
      if (retired.has(rung.model)) continue;
      const left = end - Date.now();
      if (left < 3000) return null;
      let ok = false;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${rung.model}:generateContent`,
          {
            method: "POST",
            headers: {
              "x-goog-api-key": c.key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                { parts: [{ text: c.prompt + (c.vary?.(attempt) ?? "") }] },
              ],
              generationConfig: {
                temperature: c.temperature,
                maxOutputTokens: c.maxOutputTokens,
                ...(c.json ? { responseMimeType: "application/json" } : {}),
                ...rung.config,
              },
            }),
            signal: AbortSignal.timeout(Math.min(rung.wait * 1000, left)),
          },
        );
        attempt++;
        // A name Google retired, or settings this model doesn't take: skip it from now on.
        if (res.status === 404 || res.status === 400) {
          retired.add(rung.model);
          continue;
        }
        if (!res.ok) continue;
        const out = await res.json();
        const cand = out?.candidates?.[0];
        // Cut off before it finished: the JSON is incomplete, so don't even try it.
        if (cand?.finishReason === "MAX_TOKENS") continue;
        const text: string =
          cand?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("")
            .trim() ?? "";
        if (!text) continue;
        const v = c.accept(text);
        if (v !== null) {
          ok = true;
          return v;
        }
      } catch {
        // timed out or the network failed: the next model
      } finally {
        await Promise.resolve(c.counted?.(ok)).catch(() => undefined);
      }
    }
  }
  return null;
}

/** A reply's JSON, with any Markdown fence around it removed; null when it isn't JSON. */
export function parseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as T;
  } catch {
    return null;
  }
}
