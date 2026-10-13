import { describe, expect, it } from "vitest";
import { parseMd, plainRead } from "@/lib/spc/mdText";

const RAW = `Mesoscale Discussion 2357
NWS Storm Prediction Center Norman OK

   Areas affected...Parts of central Oklahoma

   Concerning...Severe potential...Watch possible

   Valid 102112Z - 102315Z

   Probability of Watch Issuance...60 percent

   SUMMARY...Isolated supercells may produce large hail and a tornado.

   DISCUSSION...Storms are developing along the dryline with damaging wind
   gusts possible later.

   ..Smith.. 10/10/2026
`;

describe("mesoscale discussions", () => {
  it("parses VIP's fields", () => {
    const p = parseMd(RAW);
    expect(p.areas).toBe("Parts of central Oklahoma");
    expect(p.prob).toBe(60);
    expect(p.summary).toMatch(/^Isolated supercells/);
    expect(p.discussion).toMatch(/dryline/);
    expect(p.hazards).toEqual(["tornado", "hail", "wind"]);
  });

  it("reads in plain words", () => {
    const p = parseMd(RAW);
    expect(
      plainRead({ ...p, concerning: "Severe potential...Watch possible" }),
    ).toMatch(
      /^There's a 60% chance a severe-weather watch is issued for Parts of central Oklahoma.*\(likely\)\. Tornadoes, large hail and damaging winds/,
    );
    expect(plainRead({ ...p, concerning: "TORNADO WATCH 679" })).toMatch(
      /Tornado Watch 679/,
    );
  });
});
