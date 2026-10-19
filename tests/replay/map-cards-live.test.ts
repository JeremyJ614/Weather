import { describe, expect, it } from "vitest";
import { Track } from "@/features/replay/core/track";
import { cumulative } from "@/features/replay/core/geo";
import type { PreparedTornado } from "@/features/replay/core/chase";
import type { Replayable } from "@/features/replay/map/replayable";
import {
  countdownLabel,
  distanceLabel,
  durationLabel,
  hailCard,
  nextTornado,
  tornadoCards,
} from "@/features/replay/map/cards/live";

const LAT = 41.5;
const M_PER_DEG_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);

/** A chaser parked at 41.5, -88, going nowhere. */
function parked(seconds = 1800): Track {
  const n = seconds / 10 + 1;
  const t = new Float64Array(n);
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    t[i] = i * 10;
    lat[i] = LAT;
    lon[i] = -88;
  }
  return new Track(t, lat, lon);
}

/** A tornado running due east along 41.5, from `fromLon` to `toLon`. */
function tornado(
  index: number,
  fromLon: number,
  toLon: number,
  start: number,
  end: number,
  over: Partial<PreparedTornado> = {},
): PreparedTornado {
  const coords: [number, number][] = [
    [fromLon, LAT],
    [toLon, LAT],
  ];
  const cum = cumulative(coords);
  const lengthM = cum[cum.length - 1]!;
  return {
    index,
    name: `T${index}`,
    ef: "EF2",
    start,
    end,
    coords,
    cum,
    lengthM,
    widthYd: 300,
    maxwind: 125,
    injuries: 0,
    fatalities: 0,
    speedMs: lengthM / Math.max(1, end - start),
    ...over,
  };
}

function replay(
  tornadoes: PreparedTornado[],
  hail: Replayable["hail"] = [],
): Replayable {
  return {
    id: "x",
    kind: "chase",
    title: "x",
    tz: "America/Chicago",
    T0: 0,
    window: [0, 1800],
    tornadoes,
    track: parked(),
    warnings: [],
    contours: [],
    damage: [],
    hail,
    scale: "EF",
  };
}

describe("tornadoCards", () => {
  it("only shows tornadoes that are on the ground now", () => {
    const r = replay([tornado(0, -88.2, -87.8, 600, 1200)]);
    expect(tornadoCards(r, 300)).toHaveLength(0);
    expect(tornadoCards(r, 900)).toHaveLength(1);
    expect(tornadoCards(r, 1500)).toHaveLength(0);
  });

  it("measures the real distance from the chaser", () => {
    // Starts 10 km west of the chaser, ends 10 km east, over 1000 s. At the
    // halfway point it is on top of them; a quarter in, it is 5 km west.
    const tenKmDeg = 10_000 / M_PER_DEG_LON;
    const r = replay([tornado(0, -88 - tenKmDeg, -88 + tenKmDeg, 0, 1000)]);

    const quarter = tornadoCards(r, 250)[0]!;
    expect(quarter.metres).toBeGreaterThan(4_800);
    expect(quarter.metres).toBeLessThan(5_200);
    expect(quarter.fromYou).toBe("W");

    const late = tornadoCards(r, 750)[0]!;
    expect(late.fromYou).toBe("E");
  });

  it("knows whether it is closing or leaving", () => {
    const tenKmDeg = 10_000 / M_PER_DEG_LON;
    const r = replay([tornado(0, -88 - tenKmDeg, -88 + tenKmDeg, 0, 1000)]);
    // First half it is coming at them; second half it is running away.
    expect(tornadoCards(r, 250)[0]!.trend).toBe("closing");
    expect(tornadoCards(r, 750)[0]!.trend).toBe("leaving");
  });

  it("reports the heading it is actually travelling", () => {
    const r = replay([tornado(0, -88.2, -87.8, 0, 1000)]);
    expect(tornadoCards(r, 500)[0]!.heading).toBe("E");
  });

  it("converts the surveyed speed to mph", () => {
    // 16.09 km in 1000 s is 16.09 m/s, which is 36 mph.
    const sixteenKmDeg = 16_093 / M_PER_DEG_LON;
    const r = replay([tornado(0, -88, -88 + sixteenKmDeg, 0, 1000)]);
    expect(tornadoCards(r, 500)[0]!.mph).toBe(36);
  });

  it("puts the nearest tornado first", () => {
    const far = 30_000 / M_PER_DEG_LON;
    const near = 3_000 / M_PER_DEG_LON;
    const r = replay([
      tornado(0, -88 - far, -88 - far + 0.001, 0, 1000, { name: "Far" }),
      tornado(1, -88 - near, -88 - near + 0.001, 0, 1000, { name: "Near" }),
    ]);
    expect(tornadoCards(r, 500).map((c) => c.name)).toEqual(["Near", "Far"]);
  });

  it("copes with an archive day that has no chaser", () => {
    const r = { ...replay([tornado(0, -88.2, -87.8, 0, 1000)]), track: null };
    const card = tornadoCards(r, 500)[0]!;
    expect(card.metres).toBeNull();
    expect(card.fromYou).toBeNull();
    expect(card.trend).toBeNull();
    // Everything not needing a chaser still works.
    expect(card.heading).toBe("E");
    expect(card.mph).toBeGreaterThan(0);
  });
});

describe("hailCard", () => {
  const near: Replayable["hail"] = [
    [100, LAT, -88.05, 1.0, "Quarterville, IL", "Trained Spotter", ""],
    [200, LAT, -88.06, 2.75, "Baseball, IL", "Public", "measured"],
    [300, LAT, -88.07, 1.5, "Pingpong, IL", "Law Enforcement", ""],
  ];

  it("is empty before anything is reported", () => {
    expect(hailCard(replay([], near), 50)).toBeNull();
  });

  it("picks the biggest stone reported recently, not the latest", () => {
    const c = hailCard(replay([], near), 320)!;
    expect(c.inches).toBe(2.75);
    expect(c.size).toBe("Baseball");
  });

  it("forgets a report once it is old news", () => {
    // Ten minutes is the window; at 1000 s only nothing is left.
    expect(hailCard(replay([], near), 1000)).toBeNull();
  });

  it("ignores hail on the other side of the state", () => {
    const farAway: Replayable["hail"] = [
      [100, LAT, -89.5, 4.0, "Elsewhere, IL", "Public", ""],
    ];
    expect(hailCard(replay([], farAway), 150)).toBeNull();
  });

  it("keeps distant hail when there is no chaser to be distant from", () => {
    const r = {
      ...replay([], [
        [100, LAT, -89.5, 4.0, "Elsewhere, IL", "Public", ""],
      ] as Replayable["hail"]),
      track: null,
    };
    const c = hailCard(r, 150)!;
    expect(c.inches).toBe(4);
    expect(c.metres).toBeNull();
  });
});

describe("labels", () => {
  it("uses yards when miles would round to nothing", () => {
    expect(distanceLabel(180)).toMatch(/yd$/);
    expect(distanceLabel(3_000)).toBe("1.9 mi");
    expect(distanceLabel(40_000)).toBe("25 mi");
  });

  it("reads durations the way a person would say them", () => {
    expect(durationLabel(45)).toBe("45 s");
    expect(durationLabel(240)).toBe("4 min");
    expect(durationLabel(4_320)).toBe("1h 12m");
  });
});

describe("heading on a survey line that wanders", () => {
  /**
   * A real one. "Sun River Terrace 1" from the Kankakee chase is 1.31 miles
   * long with 38 vertices whose segment bearings run 270, 241, 186, 132, 21,
   * 277, 248 — every direction on the compass — on a track that is genuinely
   * heading roughly south. Sampled over a short window it reported whichever
   * way the survey line happened to jink, which looked authoritative and was
   * noise.
   */
  function wanderer(): PreparedTornado {
    const coords: [number, number][] = [];
    for (let i = 0; i <= 37; i += 1) {
      // Due south overall, with a sideways wobble far bigger than the
      // forward step — which is what the real survey line does.
      coords.push([
        -87.765 + (i % 2 === 0 ? 0.0012 : -0.0012),
        41.112 - i * 0.00026,
      ]);
    }
    const cum = cumulative(coords);
    return {
      index: 0,
      name: "Wanderer",
      ef: "EF1",
      start: 0,
      end: 300,
      coords,
      cum,
      lengthM: cum[cum.length - 1]!,
      widthYd: 150,
      maxwind: 90,
      injuries: 0,
      fatalities: 0,
      speedMs: cum[cum.length - 1]! / 300,
    };
  }

  it("reports the direction of travel, not the jink", () => {
    const r = replay([wanderer()]);
    // Sampled right through the middle of the wobble, at several moments.
    for (const at of [60, 120, 150, 180, 240]) {
      const h = tornadoCards(r, at)[0]!.heading;
      expect(["S", "SSW", "SSE"], `at ${at}s the heading read ${h}`).toContain(
        h,
      );
    }
  });

  it("gives the same answer from one moment to the next", () => {
    const r = replay([wanderer()]);
    const headings = new Set(
      [100, 110, 120, 130, 140].map((at) => tornadoCards(r, at)[0]!.heading),
    );
    // One reading, or at most two neighbouring ones — never a spin.
    expect(
      headings.size,
      `headings seen: ${[...headings].join(", ")}`,
    ).toBeLessThanOrEqual(2);
  });
});

describe("nextTornado", () => {
  const three = [
    tornado(0, -88.4, -88.3, 600, 900),
    tornado(1, -88.2, -88.1, 1800, 2100),
    tornado(2, -88.0, -87.9, 3000, 3300),
  ];

  it("finds the next one to touch down", () => {
    const r = replay(three);
    expect(nextTornado(r, 0)!.index).toBe(0);
    expect(nextTornado(r, 700)!.index).toBe(1);
    expect(nextTornado(r, 2500)!.index).toBe(2);
  });

  it("counts down to the touchdown, not to now", () => {
    const r = replay(three);
    expect(nextTornado(r, 0)!.inSeconds).toBe(600);
    expect(nextTornado(r, 540)!.inSeconds).toBe(60);
  });

  it("is empty once the last one has started", () => {
    expect(nextTornado(replay(three), 3100)).toBeNull();
  });

  /**
   * A tornado already on the ground is not the *next* one.
   *
   * Counting it would restart the countdown at zero the moment one touched
   * down and hold it there for its whole life, which is exactly when the
   * reader wants to know about the one after.
   */
  it("skips one that is already on the ground", () => {
    const r = replay(three);
    const at = 700; // tornado 0 runs 600–900
    expect(nextTornado(r, at)!.index).toBe(1);
  });

  it("says how many are still to come", () => {
    const r = replay(three);
    expect(nextTornado(r, 0)!.remaining).toBe(3);
    expect(nextTornado(r, 700)!.remaining).toBe(2);
    expect(nextTornado(r, 2500)!.remaining).toBe(1);
  });

  it("measures to where the chaser will be, not where they are", () => {
    // The stand-in chaser is parked, so the two are the same here — what is
    // being pinned is that a distance comes back at all and is sane.
    const r = replay(three);
    const n = nextTornado(r, 0)!;
    expect(n.metres).toBeGreaterThan(0);
    expect(n.metres).toBeLessThan(60_000);
  });

  it("has no distance on an archive day, rather than a wrong one", () => {
    const r = { ...replay(three), track: null };
    expect(nextTornado(r, 0)!.metres).toBeNull();
  });
});

describe("countdownLabel", () => {
  it("counts in seconds, because that is the point of a countdown", () => {
    expect(countdownLabel(272)).toBe("4:32");
    expect(countdownLabel(59)).toBe("0:59");
    expect(countdownLabel(0)).toBe("0:00");
  });

  it("only shows hours when there are any, so the layout does not jump", () => {
    expect(countdownLabel(3599)).toBe("59:59");
    expect(countdownLabel(3600)).toBe("1:00:00");
    expect(countdownLabel(7325)).toBe("2:02:05");
  });

  it("never counts below zero", () => {
    expect(countdownLabel(-40)).toBe("0:00");
  });
});
