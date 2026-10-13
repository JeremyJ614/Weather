import { describe, expect, it } from "vitest";
import { publicEnv } from "@/lib/env";

const URL = "https://ztzqemzuanwqwqzsaigd.supabase.co";
const jwt = (role: string) =>
  [
    "e30",
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "sig",
  ].join(".");

describe("publicEnv", () => {
  it("accepts a Supabase URL and publishable key", () => {
    expect(
      publicEnv({
        NEXT_PUBLIC_SUPABASE_URL: URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x",
      }),
    ).toEqual({ supabaseUrl: URL, supabaseAnonKey: "sb_publishable_x" });
  });

  it("accepts a legacy anon JWT", () => {
    expect(() =>
      publicEnv({
        NEXT_PUBLIC_SUPABASE_URL: URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
      }),
    ).not.toThrow();
  });

  it("refuses secret keys in public variables", () => {
    for (const key of [jwt("service_role"), "sb_secret_abc"]) {
      expect(() =>
        publicEnv({
          NEXT_PUBLIC_SUPABASE_URL: URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
        }),
      ).toThrow(/secret/);
    }
  });

  it("refuses a missing or foreign URL", () => {
    expect(() => publicEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toThrow();
    expect(() =>
      publicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://evil.example.com",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      }),
    ).toThrow();
  });
});
