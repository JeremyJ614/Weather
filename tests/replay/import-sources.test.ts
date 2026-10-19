import { describe, expect, it, vi } from "vitest";
import {
  discoverForRoute,
  nameFor,
  nearestTrack,
  usableName,
} from "@/features/replay/import/sources";
import type { Fix } from "@/features/replay/import/types";
import { ImportError } from "@/features/replay/import/types";

describe("usableName", () => {
  it("keeps a name a person would recognise", () => {
    expect(usableName("Winchester Tornado")).toBe("Winchester");
    expect(usableName("Orange Township")).toBe("Orange Township");
    expect(usableName("Big Spring")).toBe("Big Spring");
  });

  it("rejects the internal codes the field also holds", () => {
    // Both of these are real values from the Damage Lines layer.
    expect(usableName("20240314_darke_miami")).toBeNull();
    expect(usableName("kankakee_roselawn")).toBeNull();
  });

  it("rejects nothing at all, which is the commonest case", () => {
    expect(usableName("")).toBeNull();
    expect(usableName(null)).toBeNull();
    expect(usableName(undefined)).toBeNull();
    expect(usableName("   ")).toBeNull();
  });
});

describe("nameFor", () => {
  const reports = [
    {
      lat: 40.52,
      lon: -84.17,
      at: 1_000,
      city: "4 NNE Botkins",
      county: "Auglaize",
      st: "OH",
    },
    {
      lat: 40.49,
      lon: -83.93,
      at: 2_200,
      city: "Lakeview",
      county: "Logan",
      st: "OH",
    },
    {
      lat: 38.0,
      lon: -90.0,
      at: 1_000,
      city: "Far Away",
      county: "Elsewhere",
      st: "MO",
    },
  ];
  const track = {
    coords: [
      [-84.17, 40.52],
      [-83.93, 40.49],
    ] as [number, number][],
    start: 1_000,
    ef: "EF3",
  };

  it("prefers the name the survey already gave it", () => {
    expect(
      nameFor(
        { ...track, eventId: "Winchester Tornado" },
        reports,
        "America/New_York",
      ),
    ).toBe("Winchester");
  });

  it("names it after the worst damage, not the touchdown", () => {
    // This is the Indian Lake case: it touched down in a field near Botkins
    // and took apart Lakeview. Chasers call it Lakeview.
    expect(
      nameFor(track, reports, "America/New_York", { lat: 40.49, lon: -83.93 }),
    ).toBe("Lakeview");
  });

  it("falls back to the touchdown when the damage matches nothing", () => {
    expect(
      nameFor(track, reports, "America/New_York", { lat: 44.0, lon: -95.0 }),
    ).toBe("Botkins");
  });

  it("strips the bearing-and-distance prefix a report carries", () => {
    expect(nameFor(track, reports, "America/New_York")).toBe("Botkins");
  });

  it("names it by rating and time when nothing is near enough", () => {
    const orphan = {
      coords: [[-100, 45]] as [number, number][],
      start: 1_000,
      ef: "EF2",
    };
    expect(nameFor(orphan, reports, "America/New_York")).toMatch(
      /^EF2 tornado, \d/,
    );
  });

  it('says "Unrated" rather than "EFU tornado"', () => {
    const orphan = {
      coords: [[-100, 45]] as [number, number][],
      start: 1_000,
      ef: "EFU",
    };
    expect(nameFor(orphan, reports, "America/New_York")).toMatch(
      /^Unrated tornado, /,
    );
  });

  it("ignores a report from the right place at the wrong time", () => {
    const late = { ...track, start: 999_999 };
    expect(nameFor(late, reports, "America/New_York")).toMatch(/tornado, /);
  });
});

describe("nearestTrack", () => {
  const tracks = [
    {
      coords: [
        [-84.0, 40.0],
        [-83.9, 40.0],
      ] as [number, number][],
    },
    {
      coords: [
        [-83.0, 41.0],
        [-82.9, 41.0],
      ] as [number, number][],
    },
  ];

  it("attributes a point to the track it sits on", () => {
    expect(nearestTrack(40.0, -83.95, tracks)).toBe(0);
    expect(nearestTrack(41.0, -82.95, tracks)).toBe(1);
  });

  it("drops a point that belongs to neither", () => {
    // Halfway between them, far from both.
    expect(nearestTrack(38.0, -90.0, tracks)).toBe(-1);
  });

  it("drops a point just outside the attribution radius", () => {
    // A tenth of a degree of latitude is about 11 km, past the 5 km limit.
    expect(nearestTrack(40.1, -83.95, tracks)).toBe(-1);
    expect(nearestTrack(40.03, -83.95, tracks)).toBe(0);
  });
});

describe("discoverForRoute", () => {
  const fixes: Fix[] = [
    [1_710_000_000, 40.5, -84.0],
    [1_710_003_600, 40.6, -83.8],
  ];

  it("refuses a track with nothing to place against", async () => {
    await expect(
      discoverForRoute([[1, 2, 3]], "America/New_York"),
    ).rejects.toBeInstanceOf(ImportError);
  });

  it("says the archive is unreachable rather than throwing a network error", async () => {
    const dead = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      discoverForRoute(fixes, "America/New_York", { fetchImpl: dead as never }),
    ).rejects.toThrow(/Could not reach the survey archive/);
  });

  it("reports the server’s own status rather than guessing", async () => {
    const five0three = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      discoverForRoute(fixes, "America/New_York", {
        fetchImpl: five0three as never,
      }),
    ).rejects.toThrow(/answered 503/);
  });

  it("comes back empty-handed rather than failing when a day had no tornadoes", async () => {
    const empty = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ features: [] }),
    });
    const found = await discoverForRoute(fixes, "America/New_York", {
      fetchImpl: empty as never,
    });
    expect(found.tornadoes).toHaveLength(0);
    expect(found.damage).toHaveLength(0);
    expect(found.notes.join(" ")).toMatch(/No surveyed tornadoes/);
  });

  it("keeps the chase when only the warning archive is down", async () => {
    const partial = vi.fn(async (url: string) => {
      if (url.includes("sbw_interval")) throw new TypeError("Failed to fetch");
      return { ok: true, status: 200, json: async () => ({ features: [] }) };
    });
    const found = await discoverForRoute(fixes, "America/New_York", {
      fetchImpl: partial as never,
    });
    expect(found.warnings).toHaveLength(0);
    expect(found.notes.join(" ")).toMatch(
      /warning archive could not be reached/,
    );
  });
});

describe("attribution along a long straight track", () => {
  /**
   * Several tornadoes in the Damage Lines layer are two points miles apart —
   * "Orange Township" and "Big Spring" on the Indian Lake day are both like
   * this. Measuring a damage point's distance to the *vertices* of such a
   * track drops everything along the middle of it, which is most of the
   * survey.
   */
  const long = [
    {
      coords: [
        [-84.0, 40.0],
        [-83.5, 40.0],
      ] as [number, number][],
    },
  ];

  it("keeps a point halfway along a two-vertex track", () => {
    // Dead centre, 30 km from either end, 0 km from the line.
    expect(nearestTrack(40.0, -83.75, long)).toBe(0);
  });

  it("keeps a point just off the middle of it", () => {
    // 3.3 km north of the centre — well inside the swath of a big tornado.
    expect(nearestTrack(40.03, -83.75, long)).toBe(0);
  });

  it("still drops one genuinely off the path", () => {
    // 11 km north: past the attribution radius, however central.
    expect(nearestTrack(40.1, -83.75, long)).toBe(-1);
  });
});
