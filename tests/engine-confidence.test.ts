import { expect, it } from "vitest";
import {
  CONF_COLORS,
  cleanConfidence,
  confidenceOf,
  DEFAULT_LEVELS,
} from "@/lib/engines/confidence";

it("keeps valid confidence settings and falls back on the rest", () => {
  const c = cleanConfidence({
    levels: { tor: 4, surge: 9, nope: 2, blizz: 1.5 },
    colors: ["#ABCDEF", "red", null],
  });
  expect(c.levels.tor).toBe(4);
  expect(c.levels.surge).toBe(DEFAULT_LEVELS.surge);
  expect(c.levels.blizz).toBe(DEFAULT_LEVELS.blizz);
  expect("nope" in c.levels).toBe(false);
  expect(c.colors[0]).toBe("#abcdef");
  expect(c.colors[1]).toBe(CONF_COLORS[1]);
  expect(c.colors).toHaveLength(5);
  expect(confidenceOf(c, "tor")).toEqual({
    level: 4,
    label: "Extremely Confident / Tested & Approved",
    color: c.colors[4],
  });
  expect(cleanConfidence(undefined).levels.blind).toBe(4);
});
