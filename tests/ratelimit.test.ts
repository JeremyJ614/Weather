import { beforeEach, describe, expect, it } from "vitest";
import { limited, resetLimits } from "@/lib/ratelimit";

const req = (ip: string) =>
  new Request("https://weather.sswx.space/api/x", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });

describe("limited", () => {
  beforeEach(() => resetLimits());

  it("lets a visitor through up to the limit, then answers 429 with Retry-After", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++)
      expect(limited(req("1.1.1.1"), "b", 3, t + i)).toBeNull();
    const r = limited(req("1.1.1.1"), "b", 3, t + 10_000);
    expect(r?.status).toBe(429);
    expect(r?.headers.get("Retry-After")).toBe("50");
    expect((await r!.json()).error).toMatch(/Slow down/);
  });

  it("counts each visitor and bucket on its own", () => {
    const t = 2_000_000;
    for (let i = 0; i < 3; i++) limited(req("1.1.1.1"), "b", 3, t);
    expect(limited(req("2.2.2.2"), "b", 3, t)).toBeNull();
    expect(limited(req("1.1.1.1"), "other", 3, t)).toBeNull();
    expect(limited(req("1.1.1.1"), "b", 3, t)?.status).toBe(429);
  });

  it("starts a fresh window after a minute", () => {
    const t = 3_000_000;
    for (let i = 0; i < 4; i++) limited(req("1.1.1.1"), "b", 3, t);
    expect(limited(req("1.1.1.1"), "b", 3, t + 60_000)).toBeNull();
  });

  it("never blocks a request with no address", () => {
    const r = new Request("https://weather.sswx.space/api/x");
    for (let i = 0; i < 10; i++) expect(limited(r, "b", 1)).toBeNull();
  });
});
