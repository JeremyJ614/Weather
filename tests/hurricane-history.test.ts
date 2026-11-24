import { describe, expect, it } from "vitest";
import {
  decodeLand,
  decodePoints,
  famousIn,
  keptBy,
  stormFacts,
  stormsNear,
  summary,
  tierIndex,
  type Tracks,
} from "@/features/tropical/history/data";
import { xyz } from "@/features/tropical/history/globe";

/** Two storms packed the way scripts/build-tracks.py packs them. */
function pack() {
  const lat = [2500, 50, 50, 50, -1500, -100, -100];
  const lon = [-8000, -100, -100, -100, 17900, 200, 200];
  const hrs = [0, 6, 6, 6, 0, 6, 6];
  const wind = [40, 90, 140, 60, 35, 255, 50];
  const n = lat.length;
  const buf = new ArrayBuffer(n * 7);
  new Int16Array(buf, 0, n).set(lat);
  new Int16Array(buf, 2 * n, n).set(lon);
  new Uint16Array(buf, 4 * n, n).set(hrs);
  new Uint8Array(buf, 6 * n, n).set(wind);
  return buf;
}

function tracks(): Tracks {
  const p = decodePoints(pack(), [0, 4], 7);
  return {
    storms: {
      built: "2026-11-24",
      source: "test",
      name: ["Alpha", ""],
      y: [2005, 1900],
      b: [0, 5],
      t0: [300000, 100000],
      t1: [300018, 100012],
      o: [0, 4],
      n: [4, 3],
      w: [140, 50],
      p: [900, 0],
      a: [30, 5],
      lf: [1, 0],
      km: [500, 300],
    },
    count: 2,
    ...p,
    land: [],
    from: null,
  };
}

describe("hurricane history data", () => {
  it("adds the steps back up, across the date line too", () => {
    const t = tracks();
    expect(Array.from(t.lat).map((v) => Math.round(v * 100))).toEqual([
      2500, 2550, 2600, 2650, -1500, -1600, -1700,
    ]);
    expect(t.lon[5]).toBeCloseTo(-179, 5);
    expect(t.lon[6]).toBeCloseTo(-177, 5);
    expect(Array.from(t.hour)).toEqual([0, 6, 12, 18, 0, 6, 12]);
    expect(Array.from(t.storm)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });

  it("reads land rings", () => {
    const buf = new ArrayBuffer(4 + 4 + 3 * 4);
    const v = new DataView(buf);
    v.setUint32(0, 1, true);
    v.setUint32(4, 3, true);
    [0, 0, 1000, 0, 1000, 500].forEach((x, k) =>
      v.setInt16(8 + k * 2, x, true),
    );
    expect(Array.from(decodeLand(buf)[0])).toEqual([0, 0, 10, 0, 10, 5]);
  });

  it("filters by years, ocean, strength, place and name", () => {
    const t = tracks();
    const all = { from: 1851, to: 2030, basins: [], minTier: 0 };
    expect(Array.from(keptBy(t, all))).toEqual([1, 1]);
    expect(Array.from(keptBy(t, { ...all, from: 2000 }))).toEqual([1, 0]);
    expect(Array.from(keptBy(t, { ...all, basins: [5] }))).toEqual([0, 1]);
    expect(Array.from(keptBy(t, { ...all, minTier: 4 }))).toEqual([1, 0]);
    expect(Array.from(keptBy(t, { ...all, query: "al" }))).toEqual([1, 0]);
    expect(stormsNear(t, 25.5, -80, 100)).toEqual(new Set([0]));
    expect(
      Array.from(keptBy(t, { ...all, only: stormsNear(t, -15, 179, 50) })),
    ).toEqual([0, 1]);
  });

  it("sums a view and finds its records", () => {
    const t = tracks();
    const s = summary(t, new Uint8Array([1, 1]));
    expect(s).toMatchObject({ storms: 2, hurricanes: 1, majors: 1, ace: 4 });
    expect(s.best.hpa).toBe(0);
    expect(s.best.km).toBe(0);
  });

  it("tells a storm's story", () => {
    const f = stormFacts(tracks(), 0);
    expect(f).toMatchObject({
      name: "Alpha",
      kt: 140,
      hpa: 900,
      tier: 6,
      days: 0.8,
      landfalls: 1,
    });
    expect(f.peak.lat).toBeCloseTo(26);
    expect(stormFacts(tracks(), 1).name).toBe("Unnamed");
    expect(tierIndex(64)).toBe(2);
    expect(famousIn(tracks())).toEqual([]);
  });

  it("puts places on the globe", () => {
    const [x, y, z] = xyz(0, 0);
    expect([x, y, z].map((v) => Math.round(v * 1000) / 1000)).toEqual([
      1, 0, -0,
    ]);
    expect(xyz(90, 0)[1]).toBeCloseTo(1);
    expect(xyz(0, 90)[2]).toBeCloseTo(-1);
  });
});
