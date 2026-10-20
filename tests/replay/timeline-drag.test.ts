import { describe, expect, it } from "vitest";
import {
  clockTicks,
  precisionFor,
  ScrubDrag,
} from "@/features/replay/timeline/drag";

describe("the scrub drag", () => {
  it("follows the finger on the bar", () => {
    // A 3-hour day on a 360 px bar: 30 s a pixel.
    const d = new ScrubDrag(0, 10_800, 360, 500);
    expect(d.start(100, 0)).toBe(3000);
    expect(d.move(200, 505, 0)).toBe(6000);
    expect(d.isFine).toBe(false);
  });

  it("goes fine when the finger leaves the bar, and stays fine", () => {
    const d = new ScrubDrag(0, 10_800, 360, 500);
    d.start(100, 0);
    // 60 px above the bar: half speed. 10 px of movement = 150 s, not 300.
    expect(d.move(110, 440, 0)).toBe(3150);
    expect(d.isFine).toBe(true);
    // Far above: a twentieth. 20 px = 30 s.
    expect(d.move(130, 250, 0)).toBe(3180);
    // Back on the bar it does not jump under the finger.
    expect(d.move(140, 500, 0)).toBe(3480);
  });

  it("never leaves the day", () => {
    const d = new ScrubDrag(100, 200, 100, 0);
    expect(d.start(-50, 0)).toBe(100);
    expect(d.move(500, 0, 0)).toBe(200);
  });

  it("grades precision by distance off the bar", () => {
    expect(precisionFor(0)).toBe(1);
    expect(precisionFor(-60)).toBe(0.5);
    expect(precisionFor(120)).toBe(0.2);
    expect(precisionFor(400)).toBe(0.05);
  });
});

describe("the timeline axis", () => {
  it("labels round clock times in the chase zone", () => {
    // 21 May 2024, T0 = 13:00 CDT; three hours on 600 px.
    const T0 = Date.UTC(2024, 4, 21, 18, 0) / 1000;
    const ticks = clockTicks(0, 3 * 3600, T0, "America/Chicago", 600);
    expect(ticks.length).toBeGreaterThan(3);
    // Every tick sits on a whole step of local time.
    for (const t of ticks) expect(t.at % 900).toBe(0);
    expect(ticks[0]!.label).toMatch(/^1(:00)? PM$/);
  });
});
