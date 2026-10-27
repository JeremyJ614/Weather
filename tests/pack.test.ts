import { describe, expect, it } from "vitest";
import { packAreas, unpackAreas } from "@/lib/engines/pack";
import type { Areas } from "@/lib/engines/areas";

const areas: Areas = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { band: 0 },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-97.123, 35.456],
              [-96.5, 35.456],
              [-96.5, 36.01],
              [-97.123, 35.456],
            ],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { band: 2 },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-80, 25],
              [-79.99, 25.01],
              [-80, 25],
            ],
          ],
        ],
      },
    },
  ],
};

describe("packed engine maps", () => {
  it("round-trips shapes to the hundredth of a degree", () => {
    const back = unpackAreas(packAreas(areas));
    expect(back.features.map((f) => f.properties.band)).toEqual([0, 2]);
    const a = areas.features[0].geometry.coordinates[0][0];
    const b = back.features[0].geometry.coordinates[0][0];
    expect(b.length).toBe(a.length);
    b.forEach(([x, y], i) => {
      expect(Math.abs(x - a[i][0])).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(Math.abs(y - a[i][1])).toBeLessThanOrEqual(0.005 + 1e-9);
    });
  });

  it("is much smaller than the plain shapes", () => {
    const big: Areas = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { band: 1 },
          geometry: {
            type: "MultiPolygon",
            coordinates: [
              [
                Array.from({ length: 400 }, (_, i) => [
                  -100 + Math.cos(i / 63.7) * 4.123,
                  38 + Math.sin(i / 63.7) * 3.456,
                ]),
              ],
            ],
          },
        },
      ],
    };
    const plain = JSON.stringify(big).length;
    expect(JSON.stringify(packAreas(big)).length).toBeLessThan(plain * 0.45);
  });

  it("passes plain shapes (stored before packing) and nothing through", () => {
    expect(unpackAreas(areas)).toBe(areas);
    expect(unpackAreas(null)).toBe(null);
  });
});
