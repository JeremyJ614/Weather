import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { issueChallenge, verifySolution } from "@/lib/auth/captcha";

const solve = (c: ReturnType<typeof issueChallenge>) => {
  for (let n = 0; n <= c.max; n++)
    if (
      createHash("sha256")
        .update(c.salt + n)
        .digest("hex") === c.challenge
    )
      return { ...c, number: n };
  throw new Error("unsolved");
};

beforeAll(() => {
  process.env.PIN_PEPPER = "test-pepper-test-pepper-test-pepper-1234";
});

describe("signup human check", () => {
  it("accepts a solved, unexpired puzzle", () => {
    expect(verifySolution(solve(issueChallenge()))).toBe(true);
  });
  it("rejects a wrong answer, a forged signature and an expired puzzle", () => {
    const ok = solve(issueChallenge());
    expect(verifySolution({ ...ok, number: ok.number + 1 })).toBe(false);
    expect(verifySolution({ ...ok, signature: "0".repeat(64) })).toBe(false);
    expect(verifySolution(ok, Date.now() + 11 * 60_000)).toBe(false);
    expect(verifySolution(null)).toBe(false);
  });
});
