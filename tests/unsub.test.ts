import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("brief one-click unsubscribe", () => {
  const id = "0b6a3c1e-2f4d-4a5b-9c8d-7e6f5a4b3c2d";
  beforeAll(() => {
    process.env.CRON_SECRET = "test-secret";
  });

  it("accepts its own signature and nothing else", async () => {
    const { unsubUrl, unsubValid } = await import("@/lib/brief/unsub");
    const url = new URL(unsubUrl("https://weather.sswx.space", id));
    const sig = url.searchParams.get("s")!;
    expect(url.searchParams.get("u")).toBe(id);
    expect(unsubValid(id, sig)).toBe(true);
    expect(unsubValid(id.replace("0b", "0c"), sig)).toBe(false);
    expect(unsubValid(id, sig.slice(0, -1) + "A")).toBe(false);
    expect(unsubValid("not-a-uuid", sig)).toBe(false);
  });
});
