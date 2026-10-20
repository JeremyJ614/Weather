import { describe, expect, it } from "vitest";
import { Reveal } from "@/features/replay/map/reveal";

/** A tiny seeded generator, so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Drive a Reveal and keep what it wrote, as a map's feature state would. */
function harness(times: number[], fade: number) {
  const r = new Reveal(times, fade);
  const state = new Map<number, number>();
  return {
    r,
    state,
    go(at: number) {
      return r.step(at, (id, v) => {
        state.set(id, v);
      });
    },
  };
}

describe("Reveal", () => {
  it("writes every feature on the first step, and nothing more after", () => {
    const h = harness([10, 20, 30], 5);
    expect(h.go(0)).toBe(3);
    expect(h.go(0)).toBe(0);
    expect([...h.state.values()]).toEqual([0, 0, 0]);
  });

  it("fades a feature up across its fade window, then holds it at 1", () => {
    const h = harness([100], 60);
    h.go(0);
    h.go(100);
    expect(h.state.get(0)).toBe(0);
    h.go(130);
    expect(h.state.get(0)).toBeCloseTo(0.5, 1);
    h.go(160);
    expect(h.state.get(0)).toBe(1);
    expect(h.go(5000)).toBe(0);
  });

  it("shows a feature with no time from the start", () => {
    const h = harness([Number.NEGATIVE_INFINITY, Number.NaN, 50], 10);
    h.go(0);
    expect(h.state.get(0)).toBe(1);
    expect(h.state.get(1)).toBe(1);
    expect(h.state.get(2)).toBe(0);
  });

  it("hides features again when the clock is scrubbed backwards", () => {
    const h = harness([10, 20, 30], 1);
    h.go(100);
    expect([...h.state.values()]).toEqual([1, 1, 1]);
    h.go(15);
    expect(h.state.get(0)).toBe(1);
    expect(h.state.get(1)).toBe(0);
    expect(h.state.get(2)).toBe(0);
  });

  /**
   * The property that matters: whatever order the clock moves in — playing,
   * scrubbing, jumping — the state on the map equals what brute force says
   * it should be at that instant.
   */
  it("always matches brute force, across random plays, scrubs and jumps", () => {
    const rand = rng(7);
    const n = 1200;
    const times = Array.from({ length: n }, () => rand() * 20_000);
    const h = harness(times, 60);
    let at = 0;
    for (let step = 0; step < 3000; step += 1) {
      const roll = rand();
      if (roll < 0.7)
        at += rand() * 40; // playing
      else if (roll < 0.9)
        at += (rand() - 0.5) * 600; // scrubbing
      else at = rand() * 22_000; // jumping
      h.go(at);
      if (step % 50 === 0) {
        for (let id = 0; id < n; id += 1) {
          expect(h.state.get(id)).toBe(h.r.valueAt(times[id]!, at));
        }
      }
    }
  });

  it("touches only the features near the playhead while playing", () => {
    const times = Array.from({ length: 2000 }, (_, i) => i * 10);
    const h = harness(times, 60);
    h.go(0);
    let total = 0;
    for (let at = 1; at <= 1000; at += 1) total += h.go(at);
    // A thousand one-second frames cross a hundred reveals, each fading over
    // 24 levels: about 2,400 writes, not two million.
    expect(total).toBeLessThan(3000);
  });

  it("rewrites everything after a reset, as after a basemap swap", () => {
    const h = harness([1, 2, 3], 1);
    h.go(10);
    h.r.reset();
    expect(h.go(10)).toBe(3);
  });
});
