import { describe, expect, it } from "vitest";
import {
  EMPTY,
  MAX_PLACES,
  addPlace,
  parse,
  removePlace,
  setActive,
} from "@/features/location/store";
import { cToF, parseZip, snap, validCoords } from "@/lib/weather/geo";
import { iconFor } from "@/features/weather/WeatherIcon";
import { CloudLightning, CloudSun, Moon } from "lucide-react";

const norman = {
  label: "Norman, OK",
  lat: 35.2226,
  lon: -97.4395,
  source: "zip" as const,
};

describe("geo", () => {
  it("snaps to a 0.02° grid so cache keys stay bounded", () => {
    expect(snap(35.2226, -97.4395)).toEqual([35.22, -97.44]);
    expect(snap(35.2299, -97.4301)).toEqual([35.22, -97.44]);
  });
  it("validates input", () => {
    expect(parseZip(" 73019 ")).toBe("73019");
    expect(parseZip("7301")).toBeNull();
    expect(validCoords(35, -97)).toBe(true);
    expect(validCoords(NaN, -97)).toBe(false);
    expect(cToF(20)).toBe(68);
  });
});

describe("saved places", () => {
  it("adds, dedupes by grid cell, and activates", () => {
    const a = addPlace(EMPTY, norman)!;
    expect(a.list).toHaveLength(1);
    expect(a.active).toBe("35.22,-97.44");
    const again = addPlace(a, { ...norman, lat: 35.2201 })!;
    expect(again.list).toHaveLength(1);
  });

  it("caps the list at five", () => {
    let s = EMPTY;
    for (let i = 0; i < MAX_PLACES; i++)
      s = addPlace(s, { ...norman, lat: 30 + i })!;
    expect(addPlace(s, { ...norman, lat: 40 })).toBeNull();
  });

  it("moves the active place when it is removed", () => {
    let s = addPlace(EMPTY, norman)!;
    s = addPlace(s, { ...norman, label: "Moore, OK", lat: 35.34 })!;
    s = setActive(s, "35.22,-97.44");
    s = removePlace(s, "35.22,-97.44");
    expect(s.active).toBe("35.34,-97.44");
  });

  it("survives bad stored data", () => {
    expect(parse("not json")).toEqual(EMPTY);
    expect(parse(JSON.stringify({ list: [{ id: "x" }], active: "x" }))).toEqual(
      EMPTY,
    );
  });
});

describe("weather icons", () => {
  it("reads NWS wording", () => {
    expect(iconFor("Chance Showers And Thunderstorms", true)).toBe(
      CloudLightning,
    );
    expect(iconFor("Partly Sunny", true)).toBe(CloudSun);
    expect(iconFor("Clear", false)).toBe(Moon);
  });
});
