import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Gemini spare keys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  // The machine running the tests may have real spare keys set: blank them.
  const blank = () => {
    for (let i = 2; i <= 12; i++) vi.stubEnv(`GEMINI_API_KEY_${i}`, "");
    vi.stubEnv("GEMINI_KEYS", "");
  };
  it("puts the feature's key first, then the shared ones, each once", async () => {
    blank();
    vi.stubEnv("GEMINI_API_KEY", "main");
    vi.stubEnv("GEMINI_API_KEY_2", "spare2");
    vi.stubEnv("GEMINI_API_KEY_3", "main");
    vi.stubEnv("GEMINI_KEYS", " extra , spare2");
    const { keyPool } = await import("@/lib/ai/gemini");
    expect(keyPool("own")).toEqual(["own", "main", "spare2", "extra"]);
  });
  it("rests a key by Google's retry delay or until the daily reset", async () => {
    const { restFor } = await import("@/lib/ai/gemini");
    expect(restFor('{"retryDelay": "37s"}')).toBe(37000);
    const night = Date.parse("2026-11-26T07:00:00Z"); // 11 PM Pacific
    expect(
      restFor("GenerateRequestsPerDayPerProjectPerModel", night),
    ).toBeGreaterThan(60 * 60_000);
    expect(restFor("quota exceeded")).toBe(65000);
  });
  it("moves to the next key when one is at its limit", async () => {
    blank();
    vi.stubEnv("GEMINI_API_KEY", "tired");
    vi.stubEnv("GEMINI_API_KEY_2", "fresh");
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const k = (init.headers as Record<string, string>)["x-goog-api-key"];
        seen.push(k);
        if (k === "tired")
          return new Response(
            '{"error":{"status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"30s"}]}}',
            { status: 429 },
          );
        return Response.json({
          candidates: [
            { content: { parts: [{ text: "ok" }] }, finishReason: "STOP" },
          ],
        });
      }),
    );
    const { gemini } = await import("@/lib/ai/gemini");
    const v = await gemini({
      prompt: "hi",
      temperature: 0,
      maxOutputTokens: 10,
      accept: (t) => t,
    });
    expect(v).toBe("ok");
    expect(seen.slice(0, 2)).toEqual(["tired", "fresh"]);
  });
});
