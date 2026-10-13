import { describe, expect, it } from "vitest";
import {
  colorOf,
  isMarine,
  rankOf,
  statesOf,
  tags,
} from "@/lib/warnings/style";

describe("warnings", () => {
  it("keeps land storms and drops marine products", () => {
    for (const e of [
      "Winter Storm Warning",
      "Tropical Storm Warning",
      "Ice Storm Warning",
      "Storm Surge Warning",
      "Lakeshore Flood Warning",
    ])
      expect(isMarine(e)).toBe(false);
    for (const e of [
      "Small Craft Advisory",
      "Gale Warning",
      "Storm Warning",
      "Hurricane Force Wind Warning",
    ])
      expect(isMarine(e)).toBe(true);
  });

  it("ranks the most dangerous first", () => {
    expect(rankOf("Tornado Warning")).toBeLessThan(
      rankOf("Severe Thunderstorm Warning"),
    );
    expect(rankOf("Flash Flood Warning")).toBeLessThan(rankOf("Flood Warning"));
    expect(rankOf("Something New")).toBe(99);
    expect(colorOf("Tornado Warning")).toBe("#ff0000");
  });

  it("words NWS danger tags for people", () => {
    expect(
      tags({
        tornadoDamageThreat: "CATASTROPHIC",
        tornadoDetection: "OBSERVED",
      }).map((t) => t.label),
    ).toEqual(["Tornado Emergency", "Tornado observed"]);
    expect(
      tags({
        thunderstormDamageThreat: "DESTRUCTIVE",
        maxHailSize: "2.75",
      }).map((t) => t.label),
    ).toEqual(["Destructive", '2.75" hail']);
    expect(tags({ maxWindGust: "60 MPH" })).toEqual([]);
    expect(tags({ maxWindGust: "80 MPH" })[0].label).toBe("80 MPH gusts");
  });

  it("reads states from zone codes", () => {
    expect(statesOf(["OKC109", "OKZ025", "TXC001"])).toEqual(["OK", "TX"]);
  });
});

describe("alert ids", () => {
  it("accepts NWS CAP ids with hex hashes and rejects anything else", async () => {
    const { isAlertId } = await import("@/lib/warnings/style");
    expect(
      isAlertId(
        "urn:oid:2.49.0.1.840.0.9fa2e83d0575fbafe86dc867af8a77eec4e366b1.001.1",
      ),
    ).toBe(true);
    expect(isAlertId("urn:oid:2.49.0/../x")).toBe(false);
    expect(isAlertId("https://evil.example")).toBe(false);
  });
});
