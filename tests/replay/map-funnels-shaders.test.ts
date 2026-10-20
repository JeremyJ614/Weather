import { describe, expect, it } from "vitest";
import {
  EF_SPIN,
  FUNNEL_FRAG,
  FUNNEL_VERT,
} from "@/features/replay/map/funnels/shaders";

/**
 * The shaders are strings, so nothing type-checks them. These are the cheap
 * structural checks that catch the mistakes that actually happened.
 */
describe("the funnel shaders", () => {
  const sources = { FUNNEL_VERT, FUNNEL_FRAG };

  it("contains no backtick, which would have closed its own template literal", () => {
    // Checked on the assembled sources, so a chunk interpolated in with
    // ${...} is covered too. The mistake recurred inside exactly such a
    // chunk after this test was first written.
    // This broke the build twice: a GLSL comment written with `identifier`
    // quoting ends the template string it lives in, and the error surfaces
    // as an unrelated TypeScript complaint hundreds of lines away.
    for (const [name, src] of Object.entries(sources)) {
      expect(src.includes("`"), `${name} contains a backtick`).toBe(false);
    }
  });

  it("defines no function twice, which is a GLSL compile error", () => {
    /*
     * The shared radius functions are interpolated into both shaders. When
     * the fragment shader was given them, its own copies were supposed to be
     * removed and one was left behind — a redefinition, which fails to
     * compile, renders nothing, and looks exactly like a large performance
     * win. The frame rate went from 5 to 60 and the funnel disappeared.
     */
    for (const [name, src] of Object.entries(sources)) {
      const defs = [
        ...src.matchAll(/^\s*(?:float|vec[234]|void)\s+(\w+)\s*\(/gm),
      ].map((m) => m[1] ?? "");
      const seen = new Set<string>();
      for (const d of defs) {
        expect(seen.has(d), `${name} defines ${d} more than once`).toBe(false);
        seen.add(d);
      }
    }
  });

  it("defines every helper it calls", () => {
    for (const [name, src] of Object.entries(sources)) {
      const defined = new Set(
        [...src.matchAll(/^\s*(?:float|vec[234]|void)\s+(\w+)\s*\(/gm)].map(
          (m) => m[1] ?? "",
        ),
      );
      for (const helper of ["rCore", "rMax"]) {
        if (src.includes(`${helper}(`)) {
          expect(
            defined.has(helper),
            `${name} calls ${helper} without defining it`,
          ).toBe(true);
        }
      }
    }
  });

  it("declares the GLSL ES 3.00 version on the very first line", () => {
    // A #version directive that is not first is a compile error with a
    // famously unhelpful message.
    for (const src of Object.values(sources)) {
      expect(src.startsWith("#version 300 es\n")).toBe(true);
    }
  });

  it("passes every varying the fragment shader reads", () => {
    const outs = [
      ...FUNNEL_VERT.matchAll(/^(?:flat\s+)?out\s+\w+\s+(\w+);/gm),
    ].map((m) => m[1]);
    const ins = [
      ...FUNNEL_FRAG.matchAll(/^(?:flat\s+)?in\s+\w+\s+(\w+);/gm),
    ].map((m) => m[1]);
    expect(ins.length).toBeGreaterThan(3);
    for (const name of ins) {
      expect(
        outs,
        `${name} is read by the fragment shader but never written`,
      ).toContain(name);
    }
  });

  it("declares every attribute the layer binds", () => {
    for (const a of [
      "a_corner",
      "a_pos",
      "a_size",
      "a_look",
      "a_form",
      "a_more",
    ]) {
      expect(
        FUNNEL_VERT.includes(a),
        `${a} missing from the vertex shader`,
      ).toBe(true);
    }
  });

  it("caps the march loop at a constant, as GLSL ES requires", () => {
    // A loop bound by a uniform will not compile on some drivers; the
    // iteration count has to be a constant with an early break inside.
    expect(FUNNEL_FRAG).toMatch(/for \(int i = 0; i < \d+; i \+= 1\)/);
    expect(FUNNEL_FRAG).toContain("if (t >= t1) break;");
  });

  it("casts a real ray from the camera, so the funnel holds from any angle", () => {
    // The billboard it replaced was a flat card turned to face the camera: it
    // turned the wrong way on a rotated map and was a line from overhead.
    expect(FUNNEL_VERT).toContain("u_camera");
    expect(FUNNEL_VERT).toContain("u_inverse");
    expect(FUNNEL_FRAG).toContain("normalize(v_dir)");
  });

  it("skips empty air instead of marching through it", () => {
    expect(FUNNEL_FRAG).toContain("float gap = r - rm;");
  });

  it("fades out in the flat view, where the ground icon takes over", () => {
    expect(FUNNEL_FRAG).toContain("u_fade");
  });

  it("terminates early once the column is opaque", () => {
    expect(FUNNEL_FRAG).toContain("if (alpha > 0.98) break;");
  });

  it("jitters the ray start, which is what lets the step count stay low", () => {
    expect(FUNNEL_FRAG).toContain("dither");
  });

  it("emits premultiplied colour, matching the layer blend function", () => {
    // The march accumulates colour already multiplied by coverage, so the
    // output must stay premultiplied and the layer must blend with
    // ONE / ONE_MINUS_SRC_ALPHA. Blending premultiplied colour with SRC_ALPHA
    // multiplies by coverage twice and washes the funnel out.
    expect(FUNNEL_FRAG).toMatch(
      /fragColor = vec4\(acc \* intensity, alpha \* intensity\)/,
    );
  });
});

describe("EF_SPIN", () => {
  it("rises monotonically with the rating", () => {
    const order = ["EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
    for (let i = 1; i < order.length; i += 1) {
      expect(EF_SPIN[order[i]!]!).toBeGreaterThan(EF_SPIN[order[i - 1]!]!);
    }
  });

  it("matches the rates the brief specified", () => {
    expect(EF_SPIN.EF0).toBe(1.0);
    expect(EF_SPIN.EF1).toBe(1.35);
    expect(EF_SPIN.EF2).toBe(1.8);
    expect(EF_SPIN.EF3).toBe(2.3);
    expect(EF_SPIN.EF4).toBe(3.0);
    expect(EF_SPIN.EF5).toBe(3.8);
  });

  it("gives an unrated tornado a rate rather than undefined", () => {
    expect(EF_SPIN.EFU).toBeGreaterThan(0);
  });
});
