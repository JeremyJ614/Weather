import { describe, expect, it } from "vitest";
import { continuousEdge, gmLat } from "@/lib/aurora/style";

describe("aurora oval edge", () => {
  it("knows the geomagnetic pole sits toward North America", () => {
    // Same geographic latitude, higher geomagnetic latitude under the pole's longitude.
    expect(gmLat(45, -75)).toBeGreaterThan(gmLat(45, 105));
    expect(gmLat(80.8, -72.7)).toBeCloseTo(90, 0);
  });
  it("fills gaps along the oval and leaves no breaks or 1° stairs", () => {
    // Bright night-side edge only between 95°W and 60°W, stepping by whole degrees.
    const raw: [number, number][] = [];
    for (let lon = -95; lon <= -60; lon++)
      raw.push([lon, 48 + ((lon + 95) % 3 === 0 ? 1 : 0)]);
    const line = continuousEdge(raw, -170, -50);
    expect(line).toHaveLength(121);
    expect(
      line.every((_, i) => i === 0 || lon(line, i) - lon(line, i - 1) === 1),
    ).toBe(true);
    // Smooth: neighbors never jump by a whole degree.
    for (let i = 1; i < line.length; i++)
      expect(Math.abs(line[i][1] - line[i - 1][1])).toBeLessThan(1);
    // Filled parts follow the ring: farther west sits farther north in geographic terms.
    expect(line[0][1]).toBeGreaterThan(line[60][1]);
  });
  it("draws nothing when the oval never reaches 10%", () => {
    expect(continuousEdge([], -170, -50)).toEqual([]);
  });
});

function lon(line: [number, number][], i: number) {
  return line[i][0];
}
