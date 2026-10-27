// @vitest-environment node
import { gunzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { byYear, mergeYear, rollover, KEEP_DAYS } =
  await import("@/lib/history/rollover");

describe("history rollover", () => {
  it("groups rows by year and merges new days into a year's file", () => {
    const g = byYear([
      { day: "2023-12-31", v: 1 },
      { day: "2024-01-01", v: 2 },
      { day: "2024-02-01", v: 3 },
    ]);
    expect([...g.keys()]).toEqual(["2023", "2024"]);
    expect(g.get("2024")!.length).toBe(2);
    expect(
      mergeYear(
        [
          { day: "2024-01-02", v: "old" },
          { day: "2024-01-01", v: 1 },
        ],
        [{ day: "2024-01-02", v: "new" }],
      ),
    ).toEqual([
      { day: "2024-01-01", v: 1 },
      { day: "2024-01-02", v: "new" },
    ]);
  });

  it("files old rows before taking them out of the table", async () => {
    const now = Date.UTC(2026, 9, 2);
    const cutoff = new Date(now - KEEP_DAYS * 86400_000)
      .toISOString()
      .slice(0, 10);
    const calls: string[] = [];
    let uploaded: unknown = null;
    const table = (name: string) => {
      const q = {
        select: () => q,
        lt: (_: string, v: string) => {
          expect(v).toBe(cutoff);
          return q;
        },
        order: () => q,
        limit: async () => ({
          data: name === "chase_days" ? [{ day: "2024-01-05", top: 3 }] : [],
          error: null,
        }),
        delete: () => ({
          in: async (_: string, days: string[]) => {
            calls.push(`delete ${name} ${days.join(",")}`);
            return { error: null };
          },
        }),
      };
      return q;
    };
    const db = {
      from: table,
      storage: {
        from: () => ({
          download: async () => ({ data: null }),
          upload: async (path: string, body: Buffer) => {
            calls.push(`upload ${path}`);
            uploaded = JSON.parse(gunzipSync(body).toString());
            return { error: null };
          },
        }),
      },
    };
    const r = await rollover(db as never, now);
    expect(calls).toEqual([
      "upload chase_days/2024.json.gz",
      "delete chase_days 2024-01-05",
    ]);
    expect(uploaded).toEqual([{ day: "2024-01-05", top: 3 }]);
    expect(r.moved).toEqual({ "chase_days/2024.json.gz": 1 });
  });
});
