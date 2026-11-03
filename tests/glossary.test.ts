import { describe, expect, it } from "vitest";
import { CATEGORIES, slug, TERMS } from "@/lib/glossary/terms";

describe("glossary", () => {
  it("carries every VIP term with a topic and a description", () => {
    expect(TERMS.length).toBe(169);
    for (const t of TERMS) {
      expect(t.term && t.desc && t.category).toBeTruthy();
      expect(CATEGORIES).toContain(t.category);
    }
  });
  it("makes link-safe anchors", () => {
    expect(slug("Theta-E")).toBe("theta-e");
    expect(slug("0–1 km SRH")).toBe("0-1-km-srh");
  });
});
