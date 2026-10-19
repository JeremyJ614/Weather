import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pendingPages } from "@/lib/nav/pending";
import { ALL_PAGES } from "@/lib/nav/registry";

describe("phase notices", () => {
  it("never cover a page that has its own route", () => {
    const pending = pendingPages().map((p) => p.slug);
    for (const p of ALL_PAGES)
      if (p.slug && existsSync(join("src", "app", p.slug, "page.tsx")))
        expect(pending).not.toContain(p.slug);
    for (const slug of [
      "storm-chasing-outlook",
      "profile",
      "settings",
      "notifications",
    ])
      expect(pending).not.toContain(slug);
  });
});
