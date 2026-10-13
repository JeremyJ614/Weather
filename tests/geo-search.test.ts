import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/geo/places.data";
import { parsePlaces, searchPlaces, splitState } from "@/lib/geo/search";

const rows = parsePlaces(PLACES);
const top = (q: string) =>
  searchPlaces(rows, q).map((p) => `${p.name}, ${p.st}`);

describe("place search", () => {
  it("splits a trailing state by name or abbreviation", () => {
    expect(splitState("Dayton, OH")).toEqual({ city: "dayton", st: "OH" });
    expect(splitState("dayton ohio")).toEqual({ city: "dayton", st: "OH" });
    expect(splitState("new york")).toEqual({ city: "", st: "NY" });
    expect(splitState("bellefontaine")).toEqual({
      city: "bellefontaine",
      st: null,
    });
  });

  it("ranks exact names, then prefixes, by population", () => {
    expect(top("columbus")[0]).toBe("Columbus, OH");
    expect(top("colum").slice(0, 2)).toContain("Columbus, OH");
    expect(top("bellefontaine")[0]).toBe("Bellefontaine, OH");
    expect(top("springfield il")[0]).toBe("Springfield, IL");
    expect(top("dayton o")[0]).toBe("Dayton, OH");
    expect(top("columbus ge")[0]).toBe("Columbus, GA");
  });

  it("handles states, saints, accents and ZIPs", () => {
    expect(top("ohio")[0]).toBe("Columbus, OH");
    expect(top("washington")).toContain("Washington, DC");
    expect(top("washington")).toContain("Seattle, WA");
    expect(top("saint louis")[0]).toBe("St. Louis, MO");
    expect(top("espanola")[0]).toBe("Española, NM");
    expect(top("43311")).toEqual([]);
    expect(top("a")).toEqual([]);
  });
});
