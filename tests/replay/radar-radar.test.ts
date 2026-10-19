import { describe, expect, it } from "vitest";
import {
  buildPaletteTexture,
  decodeTile,
  reverseTable,
  NO_DATA,
  chaserStops,
} from "@/features/replay/radar/decode";
import { dbzForIndex, indexForDbz } from "@/features/replay/radar/palette";
import {
  coveredByArchive,
  scanLabel,
  snapToScan,
  stampFor,
  tileUrl,
  RADAR_PRODUCTS,
} from "@/features/replay/radar/source";

describe("the archive palette", () => {
  it("is injective, which is what makes the decode lossless", () => {
    // 256 distinct colours for 256 distinct reflectivities. If two indices
    // ever shared a colour, a pixel could not be read back to one value.
    expect(reverseTable().size).toBe(256);
  });

  it("maps an index to the reflectivity it stands for", () => {
    expect(dbzForIndex(1)).toBe(-31.5);
    expect(dbzForIndex(128)).toBe(32);
    expect(dbzForIndex(255)).toBe(95.5);
  });

  it("round-trips a reflectivity through an index", () => {
    for (const dbz of [0, 12.5, 20, 33.5, 50, 68, 75]) {
      expect(dbzForIndex(indexForDbz(dbz))).toBeCloseTo(dbz, 1);
    }
  });
});

describe("decodeTile", () => {
  const colourFor = (index: number) => {
    for (const [key, i] of reverseTable()) {
      if (i === index) return [(key >> 16) & 255, (key >> 8) & 255, key & 255];
    }
    throw new Error(`no colour for index ${index}`);
  };

  it("recovers the exact index a pixel was carrying", () => {
    const indices = [1, 64, 120, 180, 255];
    const rgba = new Uint8ClampedArray(indices.length * 4);
    indices.forEach((i, n) => {
      const [r, g, b] = colourFor(i);
      rgba[n * 4] = r!;
      rgba[n * 4 + 1] = g!;
      rgba[n * 4 + 2] = b!;
      rgba[n * 4 + 3] = 255;
    });
    expect([...decodeTile(rgba)]).toEqual(indices);
  });

  it("treats a transparent pixel as no data, not as -32 dBZ", () => {
    const [r, g, b] = colourFor(200);
    const rgba = new Uint8ClampedArray([r!, g!, b!, 0]);
    expect(decodeTile(rgba)[0]).toBe(NO_DATA);
  });

  /**
   * A colour that is not in the palette should never be guessed at.
   *
   * Snapping it to the nearest entry would invent a reflectivity, and a
   * reflectivity a chaser reads off a screen is one they might act on.
   */
  it("drops a colour it does not recognise rather than guessing", () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 255]);
    expect(decodeTile(rgba)[0]).toBe(NO_DATA);
  });
});

describe("the chaser palette", () => {
  const tex = buildPaletteTexture();
  const at = (dbz: number) => {
    const i = indexForDbz(dbz);
    return {
      r: tex[i * 4]!,
      g: tex[i * 4 + 1]!,
      b: tex[i * 4 + 2]!,
      a: tex[i * 4 + 3]!,
    };
  };

  it("draws nothing at all where there is no data", () => {
    expect([tex[0], tex[1], tex[2], tex[3]]).toEqual([0, 0, 0, 0]);
  });

  it("mutes the low values, which is the whole point of it", () => {
    // The forecaster's palette gives 15 dBZ the same presence as a core.
    expect(at(10).a).toBeLessThan(60);
    expect(at(15).a).toBeLessThan(70);
    expect(at(20).a).toBeLessThan(110);
  });

  it("gets steadily more opaque as the reflectivity climbs", () => {
    let last = -1;
    for (const dbz of [5, 15, 20, 30, 40, 50, 60, 70]) {
      const a = at(dbz).a;
      expect(
        a,
        `${dbz} dBZ is less opaque than the value below it`,
      ).toBeGreaterThan(last);
      last = a;
    }
  });

  it("is nearly solid where hail is", () => {
    expect(at(60).a).toBeGreaterThan(230);
    expect(at(70).a).toBeGreaterThan(240);
  });

  /**
   * The stops sit on the values the legend labels.
   *
   * With stops at 38 and 45 the colour at 40 dBZ was whatever the
   * interpolation produced, and it measured 3.4 from the colour at 50 under
   * deutan — two values a chaser has to tell apart, because they are rain
   * and a core.
   */
  it("has a stop on every value the legend labels", () => {
    const stopped = new Set(chaserStops().map((s) => s[0]));
    for (const dbz of [20, 30, 40, 50, 60, 70]) {
      expect(stopped.has(dbz), `no stop at ${dbz} dBZ`).toBe(true);
    }
  });
});

describe("the archive source", () => {
  it("snaps to the five-minute scan the archive actually holds", () => {
    // 19:47:33 UTC on 21 May 2024 -> the 19:45 scan.
    const at = Date.UTC(2024, 4, 21, 19, 47, 33) / 1000;
    expect(stampFor(at)).toBe("202405211945");
    expect(snapToScan(at)).toBe(Date.UTC(2024, 4, 21, 19, 45, 0) / 1000);
  });

  it("builds the tile URL the archive answers on", () => {
    const at = Date.UTC(2024, 4, 21, 19, 45, 0) / 1000;
    expect(tileUrl(at, 8, 60, 95)).toBe(
      "https://mesonet.agron.iastate.edu/c/tile.py/1.0.0/" +
        "ridge::USCOMP-N0Q-202405211945/8/60/95.png",
    );
  });

  it("refuses a day the archive does not reach", () => {
    // An empty sky over the 1974 Super Outbreak would read as "no storms".
    expect(coveredByArchive(Date.UTC(1974, 3, 3, 20) / 1000)).toBe(false);
    expect(coveredByArchive(Date.UTC(2024, 4, 21, 19) / 1000)).toBe(true);
  });

  it("says which products it cannot serve, and why", () => {
    const unavailable = RADAR_PRODUCTS.filter((p) => !p.available);
    expect(unavailable.length).toBeGreaterThan(0);
    for (const p of unavailable) {
      expect(
        p.why,
        `${p.label} is unavailable with no reason given`,
      ).toBeTruthy();
      expect(p.why!.length).toBeGreaterThan(30);
    }
  });
});

describe("the scan label", () => {
  // 2026-03-10T14:59:30Z — mid-chase, and inside the five-minute cadence.
  const at = 1773154770;

  /**
   * It printed UTC beside a clock reading local, which made "is this the right
   * scan?" a sum. Worse, the first fix asked Intl for `timeZoneName` alongside
   * `dateStyle`, which Intl rejects by throwing — so the fallback printed UTC
   * and the panel looked exactly as unfixed as before.
   */
  it("writes the scan in the zone it is given, with the zone named", () => {
    expect(scanLabel(at, "America/Chicago")).toBe("Mar 10, 2026, 9:55 AM CDT");
    expect(scanLabel(at, "America/New_York")).toBe(
      "Mar 10, 2026, 10:55 AM EDT",
    );
  });

  it("falls back to UTC on a zone it cannot read, rather than throwing", () => {
    expect(scanLabel(at, "Mars/Olympus_Mons")).toBe(
      "Mar 10, 2026, 2:55 PM UTC",
    );
  });

  it("labels the scan that covers the moment, not the moment itself", () => {
    // 14:59:30 is covered by the 14:55 scan.
    expect(scanLabel(at, "UTC")).toContain("2:55 PM");
  });
});
