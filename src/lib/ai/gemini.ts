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

/**
 * Spare keys (owner's list #41): when a key runs into Google's free limit (429), the call
 * moves to the next key for that model and leaves the tired one resting until its limit
 * resets (a minute for per-minute limits, midnight Pacific for daily ones), then comes back
 * to it. Keys: the feature's own key first, then GEMINI_API_KEY, GEMINI_API_KEY_2 … _12 and
 * any in GEMINI_KEYS (comma separated), each used once. In memory per server instance.
 */
const resting = new Map<string, number>();
const tag = (key: string, model: string) => `${key.slice(-8)}|${model}`;

export function keyPool(preferred?: string) {
  const env = process.env;
  const all = [
    preferred,
    env.GEMINI_API_KEY,
    ...Array.from({ length: 11 }, (_, i) => env[`GEMINI_API_KEY_${i + 2}`]),
    ...(env.GEMINI_KEYS ?? "").split(","),
  ]
    .map((k) => k?.trim())
    .filter((k): k is string => !!k);
  return [...new Set(all)];
}

/** Milliseconds until a 429'd key may be tried again. */
export function restFor(body: string, now = Date.now()) {
  // Google says how long in RetryInfo ("retryDelay": "37s") for per-minute limits.
  const delay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (delay) return Math.max(5, Number(delay[1])) * 1000;
  if (/PerDay|per day|daily/i.test(body)) {
    // Daily limits reset at midnight Pacific.
    const pt = new Date(
      new Date(now).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
      }),
    );
    const left =
      (24 * 3600 -
        (pt.getHours() * 3600 + pt.getMinutes() * 60 + pt.getSeconds())) *
      1000;
    return Math.max(60_000, left + 60_000);
  }
  return 65_000;
}

export type GeminiCall<T> = {
  /** The feature's own key; the shared spares follow it when it's at its limit. */
  key?: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  /** Ask for JSON (responseMimeType application/json). */
  json?: boolean;
  /** The JSON's shape (Gemini's responseSchema), so a reply can't leave fields out. */
  schema?: Record<string, unknown>;
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
  const keys = keyPool(c.key);
  if (!keys.length) return null;
  let attempt = 0;
  for (let pass = 0; pass < (c.passes ?? 1); pass++) {
    for (const rung of LADDER) {
      if (retired.has(rung.model)) continue;
      keyLoop: for (const key of keys) {
        const t = tag(key, rung.model);
        if ((resting.get(t) ?? 0) > Date.now()) continue;
        const left = end - Date.now();
        if (left < 3000) return null;
        let ok = false;
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${rung.model}:generateContent`,
            {
              method: "POST",
              headers: {
                "x-goog-api-key": key,
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
                  ...(c.schema ? { responseSchema: c.schema } : {}),
                  ...rung.config,
                },
              }),
              signal: AbortSignal.timeout(Math.min(rung.wait * 1000, left)),
            },
          );
          attempt++;
          // This key is at its free limit for this model: rest it, try the next key.
          if (res.status === 429) {
            const body = await res.text().catch(() => "");
            // A model that's simply overloaded for everyone isn't this key's fault.
            if (/overloaded|high demand/i.test(body)) break keyLoop;
            resting.set(t, Date.now() + restFor(body));
            continue;
          }
          // A name Google retired, or settings this model doesn't take: skip it from now on.
          if (res.status === 404 || res.status === 400) {
            retired.add(rung.model);
            break keyLoop;
          }
          // A key Google refuses (revoked or restricted): rest it for a day.
          if (res.status === 401 || res.status === 403) {
            resting.set(t, Date.now() + 864e5);
            continue;
          }
          if (!res.ok) break keyLoop;
          const out = await res.json();
          const cand = out?.candidates?.[0];
          // Cut off before it finished: the JSON is incomplete, so don't even try it.
          if (cand?.finishReason === "MAX_TOKENS") break keyLoop;
          const text: string =
            cand?.content?.parts
              ?.map((p: { text?: string }) => p.text ?? "")
              .join("")
              .trim() ?? "";
          if (!text) break keyLoop;
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
        // Anything but a tired key moves down the ladder; a tired key tried the next key.
        break;
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
