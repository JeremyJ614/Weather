import { describe, expect, it } from "vitest";
import { COMBINE } from "@/lib/models/core";

/** One point's records, in the order a parameter lists them (match, then extra). */
const at = (...v: number[]) => v.map((x) => Float32Array.of(x));
const K = (f: number) => ((f - 32) * 5) / 9 + 273.15;

describe("derived model fields", () => {
  it("STP (fixed layer) follows SPC's terms", () => {
    // 1500 J/kg, LCL 500 m, 150 m²/s², 20 m/s shear: every term is 1.
    expect(COMBINE.stp(at(1500, 500, 150, 20, 0), 0)).toBeCloseTo(1, 5);
    // Shear past 30 m/s caps at 1.5; under 12.5 m/s it's zero.
    expect(COMBINE.stp(at(1500, 500, 150, 0, 35), 0)).toBeCloseTo(1.5, 5);
    expect(COMBINE.stp(at(1500, 500, 150, 10, 0), 0)).toBe(0);
    // An LCL above 2 km takes it to zero; at 1.5 km it halves.
    expect(COMBINE.stp(at(1500, 2500, 150, 20, 0), 0)).toBe(0);
    expect(COMBINE.stp(at(1500, 1500, 150, 20, 0), 0)).toBeCloseTo(0.5, 5);
  });
  it("STP with CIN scales by the CIN term", () => {
    expect(COMBINE.stpc(at(1500, 500, 150, 20, 0, -125), 0)).toBeCloseTo(
      0.5,
      5,
    );
    expect(COMBINE.stpc(at(1500, 500, 150, 20, 0, -250), 0)).toBe(0);
    expect(COMBINE.stpc(at(1500, 500, 150, 20, 0, -20), 0)).toBeCloseTo(1, 5);
  });
  it("EHI is CAPE × SRH / 160,000", () => {
    expect(COMBINE.ehi(at(2000, 200), 0)).toBeCloseTo(2.5, 5);
  });
  it("Bunkers left mover sits 15 m/s across the shear from the right mover", () => {
    // Right mover (10, 0) m/s, shear due north: the left mover is (-5, 0).
    expect(COMBINE.lm(at(10, 0, 0, 20), 0)).toBeCloseTo(5, 5);
  });
  it("wind chill matches the NWS table", () => {
    // 0 °F with a 15 mph wind feels like -19 °F; above 50 °F it's the temperature.
    expect(COMBINE.wchill(at(K(0), 15 / 2.236936, 0), 0)).toBeCloseTo(-19, 0);
    expect(COMBINE.wchill(at(K(60), 10, 0), 0)).toBeCloseTo(60, 3);
  });
  it("6-hour snowfall is 10:1 on the snowy part of the precipitation", () => {
    expect(COMBINE.snow6(at(25.4, 1), 0)).toBeCloseTo(10, 5);
    expect(COMBINE.snow6(at(25.4, 0.5), 0)).toBeCloseTo(5, 5);
  });
  it("SWEAT adds its terms", () => {
    // Td850 10 °C, T850 20 °C, T500 -20 °C (TT 70), 850 mb wind 20 kt from the S,
    // 500 mb 40 kt from the WSW: 120 + 420 + 40 + 40 + shear term.
    const kt = 1 / 1.943844;
    const v = COMBINE.sweat(
      at(
        293.15,
        283.15,
        253.15,
        0,
        20 * kt,
        40 * kt * Math.sin((67.5 * Math.PI) / 180),
        40 * kt * Math.cos((67.5 * Math.PI) / 180),
      ),
      0,
    );
    const shear = 125 * (Math.sin((67.5 * Math.PI) / 180) + 0.2);
    expect(v).toBeCloseTo(120 + 420 + 40 + 40 + shear, 0);
  });
});
