// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { landfallsOn, tornadoesOn } = await import("@/lib/history/onthisday");
const { cleanStory } = await import("@/lib/history/story");

const CSV = `om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,slat,slon,elat,elon,len,wid,ns,sn,sg,f1,f2,f3,f4,fc
1,2013,05,20,2013-05-20,14:56:00,3,OK,40,0,5,212,24,0,0,35.3,-97.6,35.35,-97.4,14,1900,1,1,1,0,0,0,0,0
2,2013,05,20,2013-05-20,15:56:00,3,OK,40,0,1,0,0,0,0,35.0,-97.0,35.1,-96.9,2,100,1,1,1,0,0,0,0,0
2,2013,05,20,2013-05-20,15:56:00,3,OK,40,0,1,0,0,0,0,35.0,-97.0,35.1,-96.9,2,100,1,1,1,0,0,0,0,0
3,1957,05,20,1957-05-20,18:00:00,3,KS,20,0,5,200,44,0,0,38.8,-94.6,38.9,-94.4,71,500,2,0,1,0,0,0,0,0
4,2020,05,21,2020-05-21,12:00:00,3,TX,48,0,0,0,0,0,0,30,-97,0,0,1,50,1,1,1,0,0,0,0,0`;

const HURDAT = `AL092021,                IDA,     40,
20210829, 1655, L, HU, 29.1N,  90.2W, 130,  931,
20210830, 0000,  , TS, 31.0N,  90.0W,  55,  980,
AL122005,            KATRINA,     34,
20050829, 1110, L, HU, 29.3N,  89.6W, 110,  920,`;

describe("On This Day records", () => {
  it("counts each tornado once, multi-state ones included, strongest first", () => {
    const t = tornadoesOn(CSV, "05-20");
    expect(t.through).toBe(2020);
    expect(t.tornadoes.total).toBe(3);
    expect(t.tornadoes.deaths).toBe(68);
    expect(t.tornadoes.top[1]).toMatchObject({
      year: 2013,
      rating: "EF5",
      deaths: 24,
    });
    expect(t.tornadoes.top[0]).toMatchObject({
      year: 1957,
      rating: "F5",
      deaths: 44,
    });
    expect(t.tornadoes.paths).toHaveLength(2);
    expect(t.tornadoes.perYear.find((y) => y.year === 2013)).toEqual({
      year: 2013,
      n: 2,
      top: 5,
    });
  });

  it("finds U.S. landfalls on the date with their strength", () => {
    const l = landfallsOn(HURDAT, "08-29", "Atlantic");
    expect(l.map((x) => [x.year, x.name, x.strength, x.mph])).toEqual([
      [2021, "Ida", "Category 4 hurricane", 150],
      [2005, "Katrina", "Category 3 hurricane", 125],
    ]);
  });

  it("keeps story items that match the records and caps the rest", () => {
    const data = {
      md: "05-20",
      ...tornadoesOn(CSV, "05-20"),
      landfalls: [],
    };
    const s = cleanStory(
      JSON.stringify({
        headline: "Moore.",
        intro: "A date to remember.",
        events: [
          {
            year: 2013,
            kind: "tornado",
            title: "Moore",
            text: "EF5.",
            from: "records",
          },
          {
            year: 1999,
            kind: "tornado",
            title: "Not in the records",
            text: "x",
            from: "records",
          },
          ...[1, 2, 3, 4].map((i) => ({
            year: 1900 + i,
            kind: "flood",
            title: `F${i}`,
            text: "y",
            from: "history",
          })),
        ],
      }),
      data,
    );
    expect(s?.events.map((e) => e.title)).toEqual(["Moore", "F3", "F2", "F1"]);
  });
});
