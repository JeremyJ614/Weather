import { describe, expect, it } from "vitest";
import {
  aqiBand,
  dispersalBand,
  dispersalScore,
  inSeason,
  windMph,
} from "@/lib/air/scales";

describe("air", () => {
  it("bands AQI by EPA breakpoints", () => {
    expect(aqiBand(30).label).toBe("Good");
    expect(aqiBand(101).label).toBe("Unhealthy for sensitive groups");
    expect(aqiBand(420).label).toBe("Hazardous");
  });
  it("scores dispersal: warm dry windy mornings high, rain or night low", () => {
    const base = {
      temp: 75,
      humidity: 30,
      wind: 15,
      gust: 25,
      rainChance: 0,
      hour: 9,
    };
    const high = dispersalScore(base);
    expect(high).toBeGreaterThan(60);
    expect(dispersalScore({ ...base, rainChance: 80 })).toBeLessThan(high / 3);
    expect(dispersalScore({ ...base, hour: 2 })).toBeLessThan(high / 4);
    expect(dispersalBand(high)).toMatch(/High/);
  });
  it("parses NWS wind and knows the seasons", () => {
    expect(windMph("S 10 to 15 mph")).toBe(15);
    expect(windMph("")).toBe(0);
    expect(inSeason(9).map((s) => s.label)).toContain("Weed");
  });
});
