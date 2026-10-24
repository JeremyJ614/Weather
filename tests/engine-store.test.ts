// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const db = { rows: new Map<string, Row>(), reads: 0 };
const computed: string[] = [];
let newest = "2026102412";

/** Just enough of supabase-js's query builder for lib/engines/stored.ts. */
function table() {
  const where: ((r: Row) => boolean)[] = [];
  let mode: "select" | "update" | "upsert" = "select";
  let patch: Row = {};
  let single = false;
  let order: string | null = null;
  const q = {
    select: () => q,
    update: (v: Row) => ((mode = "update"), (patch = v), q),
    upsert: (v: Row) => ((mode = "upsert"), (patch = v), q),
    eq: (k: string, v: unknown) => (where.push((r) => r[k] === v), q),
    lt: (k: string, v: string) => (where.push((r) => String(r[k]) < v), q),
    gt: (k: string, v: string) => (where.push((r) => String(r[k]) > v), q),
    or: (s: string) => {
      const iso = s.split("refreshing_at.lt.")[1];
      where.push(
        (r) => r.refreshing_at == null || String(r.refreshing_at) < iso,
      );
      return q;
    },
    order: (k: string) => ((order = k), q),
    maybeSingle: () => ((single = true), q),
    then(ok: (v: { data: unknown; error: null }) => void) {
      let data: unknown;
      if (mode === "upsert") {
        db.rows.set(String(patch.id), {
          ...db.rows.get(String(patch.id)),
          ...patch,
        });
        data = null;
      } else {
        const hit = [...db.rows.values()].filter((r) =>
          where.every((w) => w(r)),
        );
        if (order)
          hit.sort((a, b) =>
            String(a[order!]).localeCompare(String(b[order!])),
          );
        if (mode === "update") for (const r of hit) Object.assign(r, patch);
        data = single ? (hit[0] ?? null) : hit.map((r) => ({ ...r }));
      }
      ok({ data, error: null });
    },
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: () => (db.reads++, table()) }),
}));
vi.mock("@/lib/models/render", () => ({ latestCycle: async () => newest }));
vi.mock("@/lib/engines/fields", () => ({
  fieldEngine: async (id: string) => {
    computed.push(id);
    return {
      id,
      cycle: newest,
      areas: { type: "FeatureCollection", features: [] },
    };
  },
}));

let storedField: typeof import("@/lib/engines/stored").storedField;
let refreshWanted: typeof import("@/lib/engines/stored").refreshWanted;
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const put = (id: string, cycle: string, checked: number, wanted = 0) =>
  db.rows.set(id, {
    id,
    cycle,
    data: { id, cycle },
    computed_at: ago(checked),
    checked_at: ago(checked),
    wanted_at: ago(wanted),
    refreshing_at: null,
  });

beforeEach(async () => {
  // A fresh module each time: the per-server copy must not carry between cases.
  vi.resetModules();
  ({ storedField, refreshWanted } = await import("@/lib/engines/stored"));
  db.reads = 0;
  db.rows.clear();
  computed.length = 0;
  newest = "2026102412";
});

describe("stored engine maps", () => {
  it("computes and stores a map the first time", async () => {
    const r = await storedField("stp");
    expect(computed).toEqual(["stp"]);
    expect(r.later).toBeNull();
    expect(db.rows.get("stp")?.cycle).toBe("2026102412");
  });

  it("serves a recently checked map without computing", async () => {
    put("stp", "2026102411", 5);
    const r = await storedField("stp");
    expect(r.map).toEqual({ id: "stp", cycle: "2026102411" });
    expect(r.later).toBeNull();
    expect(computed).toEqual([]);
  });

  it("marks a current map checked instead of recomputing it", async () => {
    put("stp", "2026102412", 60);
    const r = await storedField("stp");
    expect(r.later).toBeNull();
    await Promise.resolve();
    expect(
      Date.now() - Date.parse(String(db.rows.get("stp")?.checked_at)),
    ).toBeLessThan(5000);
    expect(computed).toEqual([]);
  });

  it("serves the old map at once and refreshes it after, once", async () => {
    put("stp", "2026102411", 60);
    const r = await storedField("stp");
    expect(r.map).toEqual({ id: "stp", cycle: "2026102411" });
    db.rows.get("stp")!.refreshing_at = new Date().toISOString();
    await r.later!();
    expect(computed).toEqual([]); // another server holds the claim
    db.rows.get("stp")!.refreshing_at = ago(5);
    await r.later!();
    expect(computed).toEqual(["stp"]);
    expect(db.rows.get("stp")?.cycle).toBe("2026102412");
    expect(db.rows.get("stp")?.refreshing_at).toBeNull();
  });

  it("the schedule refreshes only stale engines someone is viewing", async () => {
    put("stp", "2026102411", 60, 30); // viewed, behind
    put("scp", "2026102411", 60, 600); // nobody for 10 hours
    put("ltg", "2026102412", 60, 10); // viewed, current
    const r = await refreshWanted();
    expect(r.refreshed).toEqual(["stp"]);
    expect(computed).toEqual(["stp"]);
  });

  it("a warm server answers from its own copy without the database", async () => {
    put("stp", "2026102411", 5);
    await storedField("stp");
    const before = db.reads;
    const again = await storedField("stp");
    expect(again.map).toEqual({ id: "stp", cycle: "2026102411" });
    expect(db.reads).toBe(before);
  });
});
