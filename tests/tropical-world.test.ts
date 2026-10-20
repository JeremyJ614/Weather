import { describe, expect, it } from "vitest";
import { parseTcw, unwrap, warningCodes } from "@/lib/tropical/jtwc";
import {
  deckIds,
  parseBest,
  seasonTotals,
  summariseStorm,
} from "@/lib/tropical/season";

// Trimmed from JTWC's warning 22 on Super Typhoon 29W (Champi), 19 Oct 2026.
const TCW = [
  "WTPN52 PGTW 192100    ",
  "WARNING    ATCG MIL 29W NWP 261019194947",
  "2026101918 29W CHAMPI     022  01 305 11 SATL 010",
  "T000 154N 1367E 135 R064 065 NE QD 045 SE QD",
  "T012 165N 1344E 130 R064 060 NE QD 050 SE QD",
  "T120 289N 1239E 055 R050 090 NE QD",
  "AMP",
  "SUBJ:  SUPER TYPHOON 29W (CHAMPI) WARNING NR 022    ",
  "   MAX SUSTAINED WINDS - 135 KT, GUSTS 165 KT",
  "REMARKS:",
  "192100Z POSITION NEAR 15.7N 136.1E.",
  "MINIMUM CENTRAL PRESSURE AT 191800Z IS 919 MB. NEXT WARNINGS AT",
  "200300Z.//",
  "2926101106  95N1638E  15",
  "2926101112  90N1635E  20",
].join("\r\n");

describe("JTWC", () => {
  it("lists warnings outside NHC's basins, leaving invests out", () => {
    const rss =
      "products/wp2926.tcw products/ep2126.tcw products/sh9327.tcw products/io0326.tcw products/wp2926web.txt";
    expect(warningCodes(rss)).toEqual(["io0326", "wp2926"]);
  });

  it("reads a warning file", () => {
    const s = parseTcw(TCW, "wp2926")!;
    expect(s).toMatchObject({
      basin: "wp",
      num: "29W",
      name: "Champi",
      title: "Super Typhoon Champi",
      kt: 135,
      mph: 155,
      gustKt: 165,
      pressure: 919,
      lat: 15.4,
      lon: 136.7,
      dir: 305,
      speedMph: 13,
      warning: 22,
      valid: "2026-10-19T18:00:00Z",
    });
    expect(s.forecast.map((p) => p.tau)).toEqual([0, 12, 120]);
    expect(s.past).toEqual([
      { lat: 9.5, lon: 163.8, kt: 15 },
      { lat: 9, lon: 163.5, kt: 20 },
    ]);
    expect(s.remarks).toMatch(/^192100Z POSITION NEAR 15.7N/);
    expect(s.text).toMatch(/^SUBJ:/);
    expect(s.text).not.toMatch(/\r|2926101106/);
  });

  it("refuses a formation alert", () => {
    expect(
      parseTcw("ALERT      ATCF MIL 93X XXX\n2026101918\n", "sh9327"),
    ).toBeNull();
  });

  it("keeps a track continuous across the date line", () => {
    expect(unwrap([178, -179, -177])).toEqual([178, 181, 183]);
    expect(unwrap([-178, 179])).toEqual([-178, -181]);
  });
});

const line = (
  dtg: string,
  lat: string,
  lon: string,
  kt: number,
  mb: number,
  type: string,
  name: string,
  rad = "34",
) =>
  `AL, 05, ${dtg},   , BEST,   0, ${lat}, ${lon}, ${kt}, ${mb}, ${type}, ${rad}, NEQ,    0,    0,    0,    0, 1012,  150,  40,   0,   0,   L,   0,    ,   0,   0, ${name}, D,`;

const DECK = [
  line("2026090100", "120N", "300W", 25, 1008, "LO", "INVEST"),
  line("2026090106", "125N", "310W", 30, 1006, "TD", "FIVE"),
  line("2026090112", "130N", "320W", 45, 1000, "TS", "ERIN"),
  line("2026090112", "130N", "320W", 45, 1000, "TS", "ERIN", "50"),
  line("2026090118", "140N", "330W", 70, 985, "HU", "ERIN"),
  line("2026090200", "150N", "340W", 100, 960, "HU", "ERIN"),
  line("2026090203", "152N", "343W", 105, 955, "HU", "ERIN"),
  line("2026090206", "160N", "350W", 60, 990, "EX", "ERIN"),
].join("\n");

describe("season", () => {
  it("reads one fix per time from a b-deck", () => {
    const b = parseBest(DECK);
    expect(b.name).toBe("ERIN");
    expect(b.points).toHaveLength(7);
    expect(b.points[0]).toMatchObject({
      lat: 12,
      lon: -30,
      kt: 25,
      type: "LO",
    });
  });

  it("summarises a storm's life while tropical, with ACE at synoptic hours", () => {
    const s = summariseStorm("al052026", DECK)!;
    expect(s).toMatchObject({
      num: 5,
      name: "Erin",
      peakKt: 105,
      minMb: 955,
      peak: "MH",
      first: "2026090106",
      last: "2026090203",
      // 45² + 70² + 100² at 12, 18 and 00 UTC; the 03 UTC fix and the
      // extratropical one don't count.
      ace: 1.7,
    });
    expect(s.track).toHaveLength(7);
  });

  it("leaves out systems that never became tropical", () => {
    expect(
      summariseStorm(
        "al082026",
        line("2026091500", "200N", "800W", 50, 1004, "LO", "EIGHT"),
      ),
    ).toBeNull();
  });

  it("counts a season and reads the deck list", () => {
    const s = summariseStorm("al052026", DECK)!;
    expect(seasonTotals([s, { ...s, peakKt: 30, ace: 0 }])).toEqual({
      storms: 2,
      named: 1,
      hurricanes: 1,
      majors: 1,
      ace: 1.7,
    });
    expect(
      deckIds(
        "bal012026.dat bal052026.dat bal932026.dat bep012026.dat bal022025.dat.gz",
        "al",
        2026,
      ),
    ).toEqual(["al012026", "al052026"]);
  });
});
