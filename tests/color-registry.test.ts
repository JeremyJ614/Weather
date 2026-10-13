import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GROUPS } from "@/lib/colors/registry";

/**
 * The reminder the owner asked for (Fix-It #4): every color the app paints through
 * `pick(colors, "key", …)` must be listed in the Map & data colors editor. A new map
 * or chart that adds a color without registering it fails here.
 */
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

describe("color registry", () => {
  const keys = GROUPS.flatMap((g) => g.entries.map((e) => e.key));
  const uses = files("src").flatMap((f) =>
    [
      ...readFileSync(f, "utf8").matchAll(/pick\(\s*\w+,\s*([`"])([^`"]+)\1/g),
    ].map((m) => ({ file: f, key: m[2] })),
  );
  it("finds the app's color picks", () => {
    expect(uses.length).toBeGreaterThan(10);
  });
  it.each(uses.map((u) => [u.key, u.file]))(
    "%s (%s) is editable in admin → Map & data colors",
    (key) => {
      const re = new RegExp(
        `^${key.replace(/[.*+?^()|[\]\\]/g, "\\$&").replace(/\$\{[^}]+\}/g, "[^:]+")}$`,
      );
      expect(keys.some((k) => re.test(k))).toBe(true);
    },
  );
  it("has unique keys", () => {
    expect(new Set(keys).size).toBe(keys.length);
  });
});
