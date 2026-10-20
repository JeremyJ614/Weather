import { describe, expect, it } from "vitest";
import {
  ICON_FRAG,
  ICON_VERT,
} from "@/features/replay/map/funnels/iconShaders";

describe("the tornado icon shaders", () => {
  const sources = { ICON_VERT, ICON_FRAG };

  it("start with the GLSL ES 3.00 version line and hold no backtick", () => {
    for (const [name, src] of Object.entries(sources)) {
      expect(src.startsWith("#version 300 es\n"), name).toBe(true);
      expect(src.includes("`"), name).toBe(false);
    }
  });

  it("pass every varying the fragment shader reads", () => {
    const outs = [
      ...ICON_VERT.matchAll(/^(?:flat\s+)?out\s+\w+\s+(\w+);/gm),
    ].map((m) => m[1]);
    const ins = [...ICON_FRAG.matchAll(/^(?:flat\s+)?in\s+\w+\s+(\w+);/gm)].map(
      (m) => m[1],
    );
    expect(ins.length).toBeGreaterThan(2);
    for (const n of ins) expect(outs, n).toContain(n);
  });

  it("declare the attributes the layer binds", () => {
    for (const a of ["a_corner", "a_pos", "a_look", "a_colour", "a_flash"])
      expect(ICON_VERT).toContain(a);
  });

  it("turn cyclonically and fade with the lifecycle", () => {
    // uv y runs south, so counter-clockwise from above is decreasing angle:
    // the pattern phase must add time, and the debris heads must subtract it.
    expect(ICON_FRAG).toContain("ph = 5.0 * (ang + th");
    expect(ICON_FRAG).toContain("- u_time * w");
    expect(ICON_FRAG).toContain("a *= intensity");
  });

  it("emit premultiplied colour, to match the layer blend function", () => {
    expect(ICON_FRAG).toContain("fragColor = vec4(col * a, a);");
  });
});
