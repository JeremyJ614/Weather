import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SHOWCASE_LAST,
  TOUR_KEY,
  showcaseDue,
  tourDue,
} from "@/features/guide/due";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  };
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("guide schedule", () => {
  it("shows guests the showcase first, then weekly", () => {
    const now = Date.UTC(2026, 9, 17);
    expect(showcaseDue(now)).toBe(true);
    store.set(SHOWCASE_LAST, String(now));
    expect(showcaseDue(now + 6 * 864e5)).toBe(false);
    expect(showcaseDue(now + 7 * 864e5)).toBe(true);
  });
  it("gives members the tour once", () => {
    expect(tourDue()).toBe(true);
    store.set(TOUR_KEY, "done");
    expect(tourDue()).toBe(false);
  });
  it("never plays when storage is blocked", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(showcaseDue()).toBe(false);
    expect(tourDue()).toBe(false);
  });
});
