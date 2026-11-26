import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { gemini, LADDER, parseJson } from "@/lib/ai/gemini";

type Reply = { status: number; body?: unknown };
const reply = (text: string, finishReason = "STOP"): Reply => ({
  status: 200,
  body: { candidates: [{ finishReason, content: { parts: [{ text }] } }] },
});

/** Answers each model in turn from `plan` (keyed by model name), recording the order asked. */
function fakeFetch(plan: Record<string, Reply[]>) {
  const asked: string[] = [];
  const fn = vi.fn(async (url: string) => {
    const model = /models\/([^:]+):/.exec(url)![1];
    asked.push(model);
    const r = plan[model]?.shift() ?? { status: 503 };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status });
  });
  vi.stubGlobal("fetch", fn);
  return asked;
}

const base = {
  key: "k",
  prompt: "p",
  temperature: 0.5,
  maxOutputTokens: 100,
  json: true,
  accept: (t: string) => parseJson<{ ok: boolean }>(t),
};

afterEach(() => vi.unstubAllGlobals());

describe("gemini ladder", () => {
  it("answers from the first model when it works", async () => {
    const asked = fakeFetch({ [LADDER[0].model]: [reply('{"ok":true}')] });
    expect(await gemini(base)).toEqual({ ok: true });
    expect(asked).toEqual([LADDER[0].model]);
  });

  it("moves on past a busy model, a cut-off reply and a retired name", async () => {
    const asked = fakeFetch({
      [LADDER[0].model]: [{ status: 503 }],
      [LADDER[1].model]: [reply('{"ok":tr', "MAX_TOKENS")],
      [LADDER[2].model]: [{ status: 404 }],
      [LADDER[3].model]: [reply('```json\n{"ok":true}\n```')],
    });
    expect(await gemini(base)).toEqual({ ok: true });
    expect(asked).toEqual(LADDER.map((r) => r.model));
  });

  it("asks again on a second pass when the caller rejects every reply", async () => {
    let calls = 0;
    const asked = fakeFetch(
      Object.fromEntries(
        LADDER.map((r) => [r.model, [reply('{"n":1}'), reply('{"n":2}')]]),
      ),
    );
    const v = await gemini({
      ...base,
      passes: 2,
      accept: (t) => (++calls > LADDER.length ? parseJson(t) : null),
      counted: () => undefined,
    });
    expect(v).toEqual({ n: 2 });
    expect(asked).toHaveLength(LADDER.length + 1);
  });

  it("gives up with null when nothing usable comes back", async () => {
    fakeFetch({});
    const counted: boolean[] = [];
    expect(
      await gemini({ ...base, counted: (ok) => counted.push(ok) }),
    ).toBeNull();
    expect(counted).toEqual(LADDER.map(() => false));
  });
});
