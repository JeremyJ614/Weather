import { describe, expect, it } from "vitest";
import {
  analyze,
  bunkers,
  lcl,
  srh,
  windProfile,
  type Level,
} from "@/lib/soundings/thermo";
import { explain } from "@/lib/soundings/explain";

/** A synthetic loaded-gun profile: hot, moist surface, steep lapse aloft, veering winds. */
function profile(
  sfcT: number,
  sfcTd: number,
  lapse: number,
  veer = true,
): Level[] {
  const L: Level[] = [];
  for (let p = 1000, z = 300, t = sfcT; p >= 100; p -= 25) {
    const td = p > 850 ? sfcTd - (1000 - p) * 0.02 : t - 20;
    const k = (1000 - p) / 900;
    const dir = veer ? 150 + k * 120 : 250;
    const kt = 10 + k * 60;
    L.push([
      p,
      Math.round(z),
      Math.round(t * 10) / 10,
      Math.round(td * 10) / 10,
      dir,
      kt,
    ]);
    const dz = (287 * (t + 273.15) * Math.log(p / (p - 25))) / 9.81;
    z += dz;
    t -= (lapse * dz) / 1000;
  }
  return L;
}

describe("sounding analysis", () => {
  it("finds the LCL about 125 m per degree of spread", () => {
    const c = lcl(30, 20, 1000);
    expect(c.p).toBeGreaterThan(855);
    expect(c.p).toBeLessThan(885);
  });

  it("gives big CAPE to a hot, moist, steep profile and none to a stable one", () => {
    const hot = analyze(profile(32, 23, 7.5))!;
    expect(hot.sb.cape).toBeGreaterThan(2500);
    expect(hot.sb.lfcM).not.toBeNull();
    expect(hot.sb.elM!).toBeGreaterThan(hot.sb.lfcM!);
    expect(hot.sb.li!).toBeLessThan(-5);
    const cold = analyze(profile(10, 0, 3))!;
    expect(cold.sb.cape).toBe(0);
    expect(cold.ml.cape).toBe(0);
  });

  it("measures positive helicity in a veering profile, none without turning", () => {
    const w = windProfile(profile(30, 22, 7));
    const bk = bunkers(w)!;
    expect(srh(w, 3000, bk.rm)).toBeGreaterThan(100);
    // Right mover sits right of the mean wind relative to the shear.
    const straight = windProfile(profile(30, 22, 7, false));
    const b2 = bunkers(straight)!;
    expect(
      Math.abs(srh(straight, 1000, { u: b2.mean.u, v: b2.mean.v })),
    ).toBeLessThan(5);
  });

  it("explains what it found", () => {
    const t = explain(analyze(profile(32, 23, 7.5))!);
    expect(t).toMatch(/instability/);
    expect(t).toMatch(/shear/);
  });
});
