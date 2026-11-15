import { describe, expect, it } from "vitest";
import { fineLines, polar } from "@/features/engines/radarRead";
import type { Sweep } from "@/features/replay/radar/level2/sweep";

const site = { lat: 35, lon: -97 };
const rows = 720;
const gates = 600;
const ref = (): Sweep => ({
  moment: "REF",
  elev: 1,
  angle: 0.5,
  start: 0,
  end: 0,
  rows,
  gates,
  first: 2000,
  spacing: 250,
  scale: 2,
  offset: 66,
  data: new Uint8Array(rows * gates).fill(66 + 2 * -2),
  nyquist: null,
});
const set = (s: Sweep, lat: number, lon: number, dbz: number) => {
  const p = polar(site, lat, lon);
  const r = Math.floor(p.az / 0.5);
  const g = Math.round((p.km * 1000 - s.first) / s.spacing);
  for (const dr of [-1, 0, 1])
    for (const dg of [-2, -1, 0, 1, 2])
      s.data[((r + dr + rows) % rows) * gates + g + dg] = 66 + 2 * dbz;
};

describe("radar fine lines", () => {
  it("finds a north–south line of weak echo east of a point", () => {
    const s = ref();
    // A 15 dBZ line 50 km long, 10 km east of the point (60 km east of the radar).
    for (let km = -25; km <= 25; km += 0.25)
      set(s, 35 + km / 111.32, -97 + 60 / 91.2, 15);
    const out = fineLines(s, site, 35, -97 + 50 / 91.2);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].axis).toBe("N–S");
    expect(out[0].km).toBeLessThanOrEqual(12);
    expect(out[0].long).toBeGreaterThanOrEqual(25);
  });

  it("ignores the same line inside rain", () => {
    const s = ref();
    s.data.fill(66 + 2 * 35);
    for (let km = -25; km <= 25; km += 0.25)
      set(s, 35 + km / 111.32, -97 + 60 / 91.2, 15);
    expect(fineLines(s, site, 35, -97 + 50 / 91.2)).toHaveLength(0);
  });
});

describe("rain around the rotation", () => {
  it("counts the wet sides around a point", async () => {
    const { wrapAround } = await import("@/features/engines/radarRead");
    const s = ref();
    // Heavy rain everywhere but a 90° notch to the southeast of a point 50 km north.
    const p = polar(site, 35 + 50 / 111.32, -97);
    for (let k = 0; k < 360; k += 1) {
      if (k >= 100 && k < 190) continue;
      for (let r = 1.5; r <= 9; r += 0.25)
        set(
          s,
          35 + (50 + r * Math.cos((k * Math.PI) / 180)) / 111.32,
          -97 + (r * Math.sin((k * Math.PI) / 180)) / 91.2,
          50,
        );
    }
    const sides = wrapAround(s, p.km, p.az);
    expect(sides).toBeGreaterThanOrEqual(10);
    expect(sides).toBeLessThanOrEqual(13);
  });
});
