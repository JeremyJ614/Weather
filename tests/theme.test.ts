import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/theme/contrast";
import { FAMILY_TO_VAR, themeCss } from "@/lib/theme/css";
import {
  DEFAULT_THEME,
  FONT_SETS,
  PALETTES,
  TEMPLATES,
} from "@/lib/theme/registry";

describe("theme registry", () => {
  const pids = new Set(PALETTES.map((p) => p.id));
  const fids = new Set(FONT_SETS.map((f) => f.id));

  it("has the default and every template resolvable", () => {
    expect(pids.has(DEFAULT_THEME.palette)).toBe(true);
    expect(fids.has(DEFAULT_THEME.font)).toBe(true);
    expect(TEMPLATES).toHaveLength(13);
    for (const t of TEMPLATES) {
      expect(pids.has(t.palette), t.palette).toBe(true);
      expect(fids.has(t.font), t.font).toBe(true);
    }
  });

  it("maps every family a font set uses to a loaded font", () => {
    for (const f of FONT_SETS)
      for (const fam of [f.display, f.body, f.mono])
        expect(FAMILY_TO_VAR[fam], fam).toBeTruthy();
  });

  it("keeps every palette readable", () => {
    for (const p of PALETTES) {
      expect(contrast(p.t.text, p.t.bg), `${p.id} text`).toBeGreaterThanOrEqual(
        7,
      );
      expect(
        contrast(p.t.muted, p.t.surface),
        `${p.id} muted`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(p.t.accent, p.t.bg),
        `${p.id} accent`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("emits one block per palette and font set", () => {
    const css = themeCss();
    for (const p of PALETTES) expect(css).toContain(`[data-palette="${p.id}"]`);
    for (const f of FONT_SETS) expect(css).toContain(`[data-font="${f.id}"]`);
  });
});
