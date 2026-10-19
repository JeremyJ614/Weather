import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BADGE_ICON_NAMES } from "@/lib/badge-icons";
import { METRIC_NAMES, progressText } from "@/lib/badges";

const sql = readFileSync(
  "supabase/migrations/20261019050000_auto_badges.sql",
  "utf8",
);
// ('key', 'Name', 'Description', 'Icon', 'rarity', 'Group', 'metric', goal)
const rows = [
  ...sql.matchAll(
    /\('([a-z0-9-]+)', '([^']+)', '([^']+)', '(\w+)', '(\w+)', '([^']+)', '([a-z_:-]+)', (\d+)\)/g,
  ),
].map((m) => ({
  key: m[1],
  name: m[2],
  icon: m[4],
  rarity: m[5],
  metric: m[7],
  goal: Number(m[8]),
}));

describe("automatic badges", () => {
  it("seeds 30, with every rarity represented", () => {
    expect(rows).toHaveLength(30);
    const by = (r: string) => rows.filter((x) => x.rarity === r).length;
    expect(by("common")).toBe(10);
    expect(by("rare") + by("epic")).toBeGreaterThanOrEqual(10);
    expect(by("legendary")).toBeGreaterThanOrEqual(5);
    expect(new Set(rows.map((r) => r.key)).size).toBe(30);
    expect(rows.every((r) => r.name.length <= 40)).toBe(true);
  });
  it("uses only icons the app can draw and rules the database can count", () => {
    for (const r of rows) {
      expect(BADGE_ICON_NAMES).toContain(r.icon);
      expect(r.metric.startsWith("page:") || r.metric in METRIC_NAMES).toBe(
        true,
      );
      // Every counted metric appears in badge_metrics().
      expect(sql).toContain(
        r.metric.startsWith("page:") ? "'page:' || pv.slug" : `'${r.metric}'`,
      );
    }
  });
  it("says how far along a member is", () => {
    expect(progressText("streak", 3, 7)).toBe("3 of 7 days in a row");
    expect(progressText("points", 7200, 5000)).toBe("5,000 of 5,000 points");
    expect(progressText("page:tropical-outlook", 2, 10)).toBe("2 of 10 days");
    expect(progressText("alerts", 0, 1)).toBeNull();
  });
});
