import { describe, expect, it } from "vitest";
import { isUnread, orderPosts } from "@/features/news/readState";
import { excerpt } from "@/lib/news/posts";

const now = Date.parse("2026-10-13T12:00:00Z");
const p = (id: string, daysAgo: number) => ({
  id,
  publish_at: new Date(now - daysAgo * 86400000).toISOString(),
});

describe("SSWX News unread", () => {
  it("is unread until opened or 7 days old", () => {
    expect(isUnread(p("a", 1), new Set(), now)).toBe(true);
    expect(isUnread(p("a", 1), new Set(["a"]), now)).toBe(false);
    expect(isUnread(p("a", 8), new Set(), now)).toBe(false);
  });
  it("puts unread first, newest first in each group", () => {
    const { unread, rest } = orderPosts(
      [p("old", 10), p("read", 0), p("new", 2), p("newer", 1)],
      new Set(["read"]),
      now,
    );
    expect(unread.map((x) => x.id)).toEqual(["newer", "new"]);
    expect(rest.map((x) => x.id)).toEqual(["read", "old"]);
  });
  it("makes plain excerpts", () => {
    expect(excerpt("# Hi\n**Big** [storm](https://x.y) ahead ![a](b)")).toBe(
      "Hi Big storm ahead",
    );
  });
});
