// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { landfallsOn, pickFeatures, reportsOn, tornadoesOn, trackOf } =
  await import("@/lib/history/onthisday");
const { cleanFeature } = await import("@/lib/history/story");

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

  it("reads a storm's whole track", () => {
    expect(trackOf(HURDAT, "AL092021")).toEqual([
      [-90.2, 29.1, 130],
      [-90, 31, 55],
    ]);
  });

  it("features the date's most significant event, with only that day on the map", () => {
    const t = tornadoesOn(CSV, "05-20");
    const [f, next] = pickFeatures("05-20", t.all, [], [], {});
    expect(f).toMatchObject({
      kind: "tornado",
      year: 1957,
      label: "Tornadoes across KS",
    });
    expect(f.tracks).toHaveLength(1);
    expect(f.places).toEqual(["Kansas"]);
    expect(next).toMatchObject({ year: 2013, places: ["Oklahoma"] });
    expect(f.facts[1]).toBe(
      "44 people were killed and 200 injured by tornadoes that day.",
    );
    // A major hurricane landfall outranks a quiet tornado day.
    const l = landfallsOn(HURDAT, "08-29", "Atlantic");
    const [h] = pickFeatures("08-29", [], l, [], {
      AL092021: trackOf(HURDAT, "AL092021"),
    });
    expect(h).toMatchObject({
      kind: "hurricane",
      year: 2021,
      label: "Hurricane Ida",
    });
    expect(h.storm!.pts).toHaveLength(2);
    expect(h.accept).toEqual(["Ida"]);
    expect(h.places).toEqual(["Louisiana"]);
  });

  it("reads wind and hail reports for the date", () => {
    const W = `om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,slat,slon,elat,elon,len,wid
1,2012,06,29,2012-06-29,15:00:00,3,OH,39,0,70,0,2,0,0,40.0,-83.0,0,0,0,0
2,2012,06,30,2012-06-30,15:00:00,3,OH,39,0,60,0,0,0,0,40.0,-83.0,0,0,0,0`;
    const r = reportsOn(W, "06-29", "wind");
    expect(r).toEqual([
      { k: "wind", year: 2012, p: [-83, 40], mag: 70, fat: 2, st: "OH" },
    ]);
  });

  it("accepts a story told like a person and turns away machine tells", () => {
    const ok = {
      title: "The Moore Tornado",
      headline: "On a warm May afternoon, a storm grew over central Oklahoma.",
      story: [
        "It was a school day in Moore, and the sky to the southwest had been building since lunch.",
        "The tornado touched down west of town and grew into a mile-wide wedge as it crossed neighborhoods.",
        "By evening, families were searching for each other in streets they no longer recognized.",
      ],
    };
    expect(cleanFeature(JSON.stringify(ok))).toEqual(ok);
    expect(
      cleanFeature(
        JSON.stringify({
          ...ok,
          story: [
            ...ok.story,
            "In conclusion, it serves as a reminder of nature's power.",
          ],
        }),
      ),
    ).toBeNull();
    expect(
      cleanFeature(
        JSON.stringify({
          ...ok,
          headline: "The storm was a stark reminder of how fast things change.",
        }),
      ),
    ).toBeNull();
    expect(
      cleanFeature(JSON.stringify({ ...ok, story: ok.story.slice(0, 2) })),
    ).toBeNull();
    expect(cleanFeature("not json")).toBeNull();
  });
});
