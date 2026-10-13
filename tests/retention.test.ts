import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Storage safety rule 2: every table declares how it stops growing, in a "Retention:" comment
// within the three lines above its CREATE TABLE.
const dir = join(import.meta.dirname, "..", "supabase", "migrations");

describe("retention rules", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

  it("finds the migrations", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s: every table declares retention", (file) => {
    const lines = readFileSync(join(dir, file), "utf8").split("\n");
    const missing = lines.flatMap((line, i) => {
      const m = /^\s*create table (?:if not exists )?([\w.]+)/i.exec(line);
      if (!m) return [];
      const above = lines.slice(Math.max(0, i - 3), i).join("\n");
      return /--.*Retention:/.test(above) ? [] : [m[1]];
    });
    expect(missing).toEqual([]);
  });
});
