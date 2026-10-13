import { describe, expect, it } from "vitest";
import { postState, publishFields } from "@/lib/news/publish";

const now = new Date("2026-10-13T12:00:00Z");

describe("news publishing", () => {
  it("drafts have no publish time", () => {
    expect(publishFields("draft", "", null, now)).toEqual({
      status: "draft",
      publish_at: null,
    });
  });
  it("publish now keeps an existing past publish time", () => {
    expect(publishFields("now", "", null, now)).toEqual({
      status: "published",
      publish_at: now.toISOString(),
    });
    const old = { status: "published", publish_at: "2026-10-01T00:00:00.000Z" };
    expect(publishFields("now", "", old, now)).toEqual({
      status: "published",
      publish_at: old.publish_at,
    });
  });
  it("schedules only in the future, within a year", () => {
    expect(
      publishFields("schedule", "2026-10-14T09:00:00Z", null, now),
    ).toEqual({
      status: "published",
      publish_at: "2026-10-14T09:00:00.000Z",
    });
    expect(
      publishFields("schedule", "2026-10-12T09:00:00Z", null, now),
    ).toHaveProperty("error");
    expect(
      publishFields("schedule", "2028-01-01T00:00:00Z", null, now),
    ).toHaveProperty("error");
    expect(publishFields("schedule", "", null, now)).toHaveProperty("error");
  });
  it("labels posts", () => {
    expect(postState({ status: "draft", publish_at: null })).toBe("Draft");
    expect(
      postState({ status: "published", publish_at: "2999-01-01T00:00:00Z" }),
    ).toBe("Scheduled");
    expect(
      postState({ status: "published", publish_at: "2000-01-01T00:00:00Z" }),
    ).toBe("Published");
  });
});
