import { describe, expect, it, vi } from "vitest";
import { claimMapbox, mapboxToken } from "@/features/map/provider";

const URL_ = "https://abc.supabase.co";
const reply = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe("map provider", () => {
  it("accepts only public pk tokens", () => {
    expect(mapboxToken("pk.abc")).toBe("pk.abc");
    expect(mapboxToken("sk.abc")).toBeNull();
    expect(mapboxToken(undefined)).toBeNull();
  });

  it("uses Mapbox only when the counter grants a load", async () => {
    expect(await claimMapbox("pk.a", URL_, "k", reply(true))).toBe(true);
    expect(await claimMapbox("pk.a", URL_, "k", reply(false))).toBe(false);
  });

  it("falls back to MapLibre whenever anything is uncertain", async () => {
    const f = reply(true);
    expect(await claimMapbox(null, URL_, "k", f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(await claimMapbox("pk.a", undefined, "k", f)).toBe(false);
    expect(await claimMapbox("pk.a", URL_, "k", reply(null, false))).toBe(
      false,
    );
    const boom = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await claimMapbox("pk.a", URL_, "k", boom)).toBe(false);
  });

  it("gives up on a slow counter", async () => {
    const slow = vi.fn(
      (_u: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, rej) =>
          init?.signal?.addEventListener("abort", () =>
            rej(new Error("abort")),
          ),
        ),
    );
    expect(await claimMapbox("pk.a", URL_, "k", slow, 20)).toBe(false);
  });
});
