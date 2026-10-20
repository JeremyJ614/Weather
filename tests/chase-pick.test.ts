import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { pickTwo } = await import("@/lib/chase/engine");

const at = (lat: number, lon: number) => ({ lat, lon });

describe("pickTwo", () => {
  it("skips a runner-up too close to the best target", () => {
    const best = at(35.5, -97.5);
    const near = at(35.9, -97.9); // ~57 km
    const far = at(37.7, -97.3); // ~245 km
    expect(pickTwo([best, near, far])).toEqual([best, far]);
  });

  it("falls back to the runner-up only when nothing is far enough", () => {
    const best = at(35.5, -97.5);
    const near = at(35.9, -97.9);
    expect(pickTwo([best, near])).toEqual([best, near]);
    expect(pickTwo([best])).toEqual([best]);
    expect(pickTwo([])).toEqual([]);
  });
});
