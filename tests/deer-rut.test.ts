import { describe, expect, it } from "vitest";
import { dropFactor, rutBoost } from "@/lib/engines/outdoor";
import { pressureFactor, rutFor } from "@/lib/engines/rut";

describe("deer rut by state", () => {
  it("gives each state its own peak, with zones", () => {
    expect(rutFor("MI", 43, -85)?.peak).toBe("11-09");
    // South Alabama peaks in January, north Alabama before Christmas.
    expect(rutFor("AL", 31, -87)?.peak).toBe("01-17");
    expect(rutFor("AL", 34.5, -86.5)?.peak).toBe("12-17");
    // South Florida breeds in summer.
    expect(rutFor("FL", 25.8, -80.5)?.peak).toBe("08-07");
    expect(rutFor("XX", 0, 0)).toBeNull();
  });

  it("uses the owner's own state from admin", () => {
    const own = {
      state: "Ohio",
      rut: { pre: "10-20", peak: "11-01", post: "11-15", end: "12-01" },
    };
    expect(rutFor("OH", 40, -83, own)).toBe(own.rut);
  });

  it("follows a rut across New Year", () => {
    const rut = rutFor("AL", 31, -87)!;
    expect(rutBoost(new Date(Date.UTC(2027, 0, 20)), rut)).toBe(1.5);
    expect(rutBoost(new Date(Date.UTC(2027, 0, 8)), rut)).toBe(1.25);
    expect(rutBoost(new Date(Date.UTC(2027, 1, 10)), rut)).toBe(1.15);
    expect(rutBoost(new Date(Date.UTC(2026, 9, 1)), rut)).toBe(1);
    // A December peak that ends in January.
    const tx = rutFor("TX", 27.5, -98)!;
    expect(rutBoost(new Date(Date.UTC(2027, 0, 10)), tx)).toBe(1.15);
  });

  it("cuts daylight movement in gun season's opening days", () => {
    // Michigan opens November 15; Pennsylvania the Saturday after Thanksgiving.
    expect(pressureFactor("MI", Date.UTC(2026, 10, 15))).toBe(0.8);
    expect(pressureFactor("MI", Date.UTC(2026, 10, 20))).toBe(0.9);
    expect(pressureFactor("MI", Date.UTC(2026, 10, 30))).toBe(1);
    expect(pressureFactor("PA", Date.UTC(2026, 10, 28))).toBe(0.8);
    expect(pressureFactor("PA", Date.UTC(2026, 10, 27))).toBe(1);
  });
});

describe("rainbow drop size", () => {
  it("favors heavier showers", () => {
    expect(dropFactor(18)).toBeLessThan(dropFactor(30));
    expect(dropFactor(45)).toBeGreaterThan(dropFactor(30));
  });
});
