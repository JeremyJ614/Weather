import { describe, expect, it } from "vitest";
import {
  characterOf,
  lifeAt,
  proximityOf,
  trailOpacity,
  visibleWindow,
} from "@/features/replay/map/funnels/lifecycle";

const EF3 = characterOf("EF3");

describe("characterOf", () => {
  it("makes a wedge a different object from a rope, not a recolour", () => {
    const rope = characterOf("EF0");
    const wedge = characterOf("EF5");
    expect(wedge.baseWidthM).toBeGreaterThan(rope.baseWidthM * 10);
    expect(wedge.opacity).toBeGreaterThan(rope.opacity);
    expect(wedge.debris).toBeGreaterThan(rope.debris);
    expect(wedge.heightM).toBeGreaterThan(rope.heightM);
  });

  it("grows monotonically with rating, so the scale reads in order", () => {
    const order = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"].map(
      characterOf,
    );
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]!.baseWidthM).toBeGreaterThan(order[i - 1]!.baseWidthM);
      expect(order[i]!.opacity).toBeGreaterThanOrEqual(order[i - 1]!.opacity);
    }
  });

  it("falls back to unrated rather than throwing on something unexpected", () => {
    expect(characterOf("EF9")).toEqual(characterOf("EFU"));
    expect(characterOf("ef3")).toEqual(characterOf("EF3"));
  });
});

describe("lifeAt", () => {
  const start = 1000;
  const end = 1600;

  it("draws nothing before the funnel starts descending", () => {
    const s = lifeAt(start, end, start - EF3.formingSeconds - 1, EF3);
    expect(s.phase).toBe("before");
    expect(s.intensity).toBe(0);
  });

  it("draws the funnel descending before the surveyed touchdown", () => {
    // The survey records when it became a tornado, not when it became visible.
    const s = lifeAt(start, end, start - EF3.formingSeconds / 2, EF3);
    expect(s.phase).toBe("forming");
    expect(s.reach).toBeGreaterThan(0);
    expect(s.reach).toBeLessThan(1);
    expect(s.intensity).toBeGreaterThan(0);
  });

  it("has not reached the ground while forming, and has once mature", () => {
    expect(lifeAt(start, end, start - 10, EF3).reach).toBeLessThan(1);
    expect(lifeAt(start, end, start + 60, EF3).reach).toBe(1);
  });

  it("flashes at touchdown and only briefly", () => {
    expect(lifeAt(start, end, start, EF3).flash).toBeGreaterThan(0.9);
    expect(lifeAt(start, end, start + 1, EF3).flash).toBeGreaterThan(0);
    expect(lifeAt(start, end, start + 10, EF3).flash).toBe(0);
    // Never before it touches down.
    expect(lifeAt(start, end, start - 5, EF3).flash).toBe(0);
  });

  it("widens over the first half-minute rather than arriving at full size", () => {
    const early = lifeAt(start, end, start + 2, EF3);
    const later = lifeAt(start, end, start + 40, EF3);
    expect(later.widthScale).toBeGreaterThan(early.widthScale);
  });

  it("ropes out: narrows hard and leans over", () => {
    const mature = lifeAt(start, end, start + 60, EF3);
    const roping = lifeAt(start, end, end - 5, EF3);
    expect(roping.phase).toBe("roping");
    expect(roping.widthScale).toBeLessThan(mature.widthScale * 0.4);
    expect(roping.tilt).toBeGreaterThan(0.4);
    // Still visible — a rope is thin, not invisible.
    expect(roping.intensity).toBeGreaterThan(0.1);
  });

  it("draws nothing after it lifts", () => {
    expect(lifeAt(start, end, end + 1, EF3).phase).toBe("after");
    expect(lifeAt(start, end, end + 1, EF3).intensity).toBe(0);
  });

  it("breathes while mature instead of standing still", () => {
    const a = lifeAt(start, end, start + 100, EF3).widthScale;
    const b = lifeAt(start, end, start + 105, EF3).widthScale;
    expect(a).not.toBe(b);
  });

  it("never returns a width or intensity outside its bounds, at any moment", () => {
    // A brief tornado has a roping window longer than its whole life; the
    // maths must not produce a negative width or an intensity above one.
    const brief = characterOf("EF5");
    for (let at = 900; at <= 1700; at += 1) {
      const s = lifeAt(1000, 1060, at, brief);
      expect(s.widthScale).toBeGreaterThanOrEqual(0);
      expect(s.intensity).toBeGreaterThanOrEqual(0);
      expect(s.intensity).toBeLessThanOrEqual(1.0001);
      expect(Number.isFinite(s.tilt)).toBe(true);
    }
  });

  it("copes with a zero-length tornado rather than dividing by it", () => {
    const s = lifeAt(1000, 1000, 1000, EF3);
    expect(Number.isFinite(s.progress)).toBe(true);
    expect(Number.isFinite(s.widthScale)).toBe(true);
  });
});

describe("visibleWindow", () => {
  it("starts before the survey does, because the funnel was already visible", () => {
    const [from, to] = visibleWindow(1000, 1600, EF3);
    expect(from).toBeLessThan(1000);
    expect(to).toBe(1600);
  });
});

describe("trailOpacity", () => {
  it("holds near the tornado and drops away behind it", () => {
    expect(trailOpacity(0)).toBe(1);
    expect(trailOpacity(60)).toBeGreaterThan(trailOpacity(180));
    expect(trailOpacity(240)).toBe(0);
  });

  it("reports nothing outside its lifetime", () => {
    expect(trailOpacity(-1)).toBe(0);
    expect(trailOpacity(9999)).toBe(0);
  });
});

describe("proximityOf", () => {
  it("uses the distances chasers actually use", () => {
    expect(proximityOf(300)).toBe("imminent"); // under a quarter mile
    expect(proximityOf(1200)).toBe("close"); // under a mile
    expect(proximityOf(2500)).toBe("near"); // under two miles
    expect(proximityOf(8000)).toBe("safe");
  });

  it("is inclusive at each threshold", () => {
    expect(proximityOf(402)).toBe("imminent");
    expect(proximityOf(1609)).toBe("close");
    expect(proximityOf(3219)).toBe("near");
  });
});
