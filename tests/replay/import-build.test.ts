import { describe, expect, it } from "vitest";
import type { DamagePoint, HailReport } from "@/features/replay/core/chase";
import {
  buildPayload,
  chaseId,
  summarise,
  suggestTitle,
} from "@/features/replay/import/build";
import type { DiscoveryBundle } from "@/features/replay/import/sources";
import type { Fix, ParsedTrack } from "@/features/replay/import/types";
import { ImportError } from "@/features/replay/import/types";

/** A drive east across Illinois, one fix a minute. */
function track(minutes = 120, startEpoch = 1_710_000_000): ParsedTrack {
  const fixes: Fix[] = [];
  for (let i = 0; i <= minutes; i += 1) {
    fixes.push([startEpoch + i * 60, 41.0, -88.5 + i * 0.004]);
  }
  return { fixes, format: "gpx", notes: [] };
}

describe("summarise", () => {
  it("measures the drive", () => {
    const s = summarise(track(120));
    expect(s.fixes).toBe(121);
    expect(s.miles).toBeGreaterThan(20);
    expect(s.tz).toBe("America/Chicago");
    expect(s.day).toBe("2024-03-09");
  });

  it("refuses a file with no track in it", () => {
    expect(() =>
      summarise({ fixes: [[1, 2, 3]], format: "gpx", notes: [] }),
    ).toThrow(ImportError);
  });

  it("refuses a track whose times go nowhere", () => {
    const flat: ParsedTrack = {
      fixes: [
        [100, 41, -88],
        [100, 41, -87],
      ],
      format: "csv",
      notes: [],
    };
    expect(() => summarise(flat)).toThrow(/no usable timestamps/);
  });

  it("carries the parser’s own notes through", () => {
    const t = track();
    t.notes.push("Dropped 4 fixes with no time.");
    expect(summarise(t).warnings).toContain("Dropped 4 fixes with no time.");
  });

  it("points out a jump rather than smoothing over it", () => {
    const t = track(10);
    t.fixes.splice(5, 0, [t.fixes[4]![0] + 30, 44.0, -95.0]);
    expect(summarise(t).warnings.join(" ")).toMatch(/jump/);
  });

  it("points out a file covering several days", () => {
    const t = track(60 * 24 * 3);
    expect(summarise(t).warnings.join(" ")).toMatch(/covers 3\.\d days/);
  });
});

describe("chaseId", () => {
  it("is the day, when the day is free", () => {
    expect(chaseId("2024-03-14", ["2026-03-10"])).toBe("2024-03-14");
  });

  it("only gets a suffix when the day is taken", () => {
    expect(chaseId("2024-03-14", ["2024-03-14"])).toBe("2024-03-14-2");
    expect(chaseId("2024-03-14", ["2024-03-14", "2024-03-14-2"])).toBe(
      "2024-03-14-3",
    );
  });
});

describe("buildPayload", () => {
  const parsed = track(120);
  const summary = summarise(parsed);

  const found: DiscoveryBundle = {
    tornadoes: [
      {
        name: "Alpha",
        ef: "EF1",
        start: 600,
        end: 900,
        coords: [
          [-88.4, 41.0],
          [-88.3, 41.0],
        ],
      },
      {
        name: "Bravo",
        ef: "EF3",
        start: 1200,
        end: 1800,
        coords: [
          [-88.2, 41.0],
          [-88.1, 41.0],
        ],
      },
      {
        name: "Delta",
        ef: "EF0",
        start: 2400,
        end: 2500,
        coords: [
          [-88.0, 41.0],
          [-87.9, 41.0],
        ],
      },
    ],
    contours: [
      {
        t: 0,
        ef: "EF1",
        ring: [
          [-88.4, 41.0],
          [-88.3, 41.0],
          [-88.3, 41.01],
          [-88.4, 41.0],
        ],
      },
      {
        t: 2,
        ef: "EF0",
        ring: [
          [-88.0, 41.0],
          [-87.9, 41.0],
          [-87.9, 41.01],
          [-88.0, 41.0],
        ],
      },
    ],
    damage: [
      [41.0, -88.35, "EF1", 95, "Barn", "Roof gone", 0],
      [41.0, -88.15, "EF3", 150, "House", "Levelled", 1],
      [41.0, -87.95, "EF0", 70, "Trees", "Limbs", 2],
    ] as DamagePoint[],
    hail: [
      [300, 41.0, -88.4, 1.75, "Somewhere, IL", "Spotter", ""],
    ] as HailReport[],
    warnings: [],
    notes: ["3 surveyed tornadoes"],
  };

  it("puts the whole track in, relative to T0", () => {
    const p = buildPayload({ parsed, summary, found, title: "Test" });
    expect(p.T0).toBe(summary.from);
    expect(p.track).toHaveLength(121);
    expect(p.track[0]![0]).toBe(0);
    expect(p.track[120]![0]).toBe(7200);
  });

  it("keeps everything when nothing is deselected", () => {
    const p = buildPayload({ parsed, summary, found, title: "Test" });
    expect(p.torn).toHaveLength(3);
    expect(p.dpts).toHaveLength(3);
    expect(p.polys).toHaveLength(2);
    expect(p.hail).toHaveLength(1);
  });

  /**
   * The one that would be silent if it broke.
   *
   * Damage points and contours address their tornado by index. Dropping one
   * renumbers the rest, so without renumbering the survivors, a town's damage
   * ends up attached to a different tornado — on the map, at the wrong time,
   * with no error anywhere.
   */
  it("renumbers everything that points at a tornado when one is dropped", () => {
    const p = buildPayload({
      parsed,
      summary,
      found,
      title: "Test",
      keep: [0, 2],
    });
    expect(p.torn.map((t) => t.name)).toEqual(["Alpha", "Delta"]);

    // Alpha keeps index 0; Delta moves from 2 to 1. Bravo's damage goes.
    expect(p.dpts!.map((d) => [d[4], d[6]])).toEqual([
      ["Barn", 0],
      ["Trees", 1],
    ]);
    expect(p.polys!.map((c) => [c.ef, c.t])).toEqual([
      ["EF1", 0],
      ["EF0", 1],
    ]);
  });

  it("drops the damage belonging to a tornado that was dropped", () => {
    const p = buildPayload({
      parsed,
      summary,
      found,
      title: "Test",
      keep: [1],
    });
    expect(p.torn.map((t) => t.name)).toEqual(["Bravo"]);
    expect(p.dpts!.every((d) => d[6] === 0)).toBe(true);
    expect(p.dpts).toHaveLength(1);
    expect(p.polys).toHaveLength(0);
  });

  it("keeps hail whatever is deselected, because hail is not a tornado’s", () => {
    const p = buildPayload({ parsed, summary, found, title: "Test", keep: [] });
    expect(p.torn).toHaveLength(0);
    expect(p.hail).toHaveLength(1);
  });

  it("records where it came from", () => {
    const p = buildPayload({ parsed, summary, found, title: "Test" });
    expect(p.notes!.join(" ")).toMatch(/Imported from GPX/);
    expect(p.notes!.join(" ")).toMatch(/3 surveyed tornadoes/);
  });
});

describe("suggestTitle", () => {
  const summary = summarise(track());

  it("offers the strongest tornado of the day", () => {
    const found = {
      tornadoes: [
        {
          name: "Alpha",
          ef: "EF1",
          start: 0,
          end: 1,
          coords: [] as [number, number][],
        },
        {
          name: "Bravo",
          ef: "EF3",
          start: 0,
          end: 1,
          coords: [] as [number, number][],
        },
      ],
      contours: [],
      damage: [],
      hail: [],
      warnings: [],
      notes: [],
    } as DiscoveryBundle;
    expect(suggestTitle(found, summary)).toBe("Bravo");
  });

  it("offers the date when the day had none", () => {
    const empty = {
      tornadoes: [],
      contours: [],
      damage: [],
      hail: [],
      warnings: [],
      notes: [],
    } as DiscoveryBundle;
    expect(suggestTitle(empty, summary)).toMatch(/2024/);
  });
});
