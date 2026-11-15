import { describe, expect, it } from "vitest";
import { findLines, ingredients } from "@/lib/engines/qlcs";
import {
  boosted,
  vrotChance,
  withRadar,
  type Cell,
  type TorOutlook,
} from "@/lib/engines/project";
import { beamFt, couplet, polar } from "@/features/engines/radarRead";
import type { Sweep } from "@/features/replay/radar/level2/sweep";

const cell = (
  id: string,
  lat: number,
  lon: number,
  east = 15,
  north = 0,
): Cell => ({
  id,
  lat,
  lon,
  ring: [
    [lon - 0.05, lat - 0.05],
    [lon + 0.05, lat - 0.05],
    [lon + 0.05, lat + 0.05],
    [lon - 0.05, lat + 0.05],
  ],
  tor: 5,
  wind: 60,
  severe: 70,
  az: 0.004,
  flash: 5,
  jump: false,
  east,
  north,
});

describe("squall-line boost", () => {
  // A north–south line of five storms 30 km apart, moving east.
  const line = [0, 1, 2, 3, 4].map((i) => cell(`c${i}`, 35 + i * 0.27, -97));

  it("finds a north–south line moving east", () => {
    const [l] = findLines(line);
    expect(l).toBeDefined();
    expect(l.ids).toHaveLength(5);
    expect(Math.abs(l.along[1])).toBeGreaterThan(0.95);
    expect(l.normal[0]).toBeGreaterThan(0.95);
    expect(l.km).toBeGreaterThanOrEqual(80);
  });

  it("does not call a round cluster a line", () => {
    const blob = [
      cell("a", 35, -97),
      cell("b", 35.2, -97),
      cell("c", 35, -96.75),
      cell("d", 35.2, -96.75),
    ];
    expect(findLines(blob)).toHaveLength(0);
  });

  it("meets all three ingredients for westerly shear and a surging storm", () => {
    const [l] = findLines(line);
    const surging = { ...line[2], east: 20 };
    const i = ingredients(surging, l, [40, 5]);
    expect(i.met).toBe(3);
    expect(i.boost).toBe(2);
    // Shear along the line (southerly) does not count across it.
    expect(ingredients(line[2], l, [0, 40]).boost).toBe(1);
  });

  it("scales the outlook and keeps the cap", () => {
    const o: TorOutlook = {
      now: 10,
      p20: 10,
      p40: 7,
      p60: 5,
      trend: "steady",
      jump: false,
    };
    expect(boosted(o, 2).p20).toBe(20);
    expect(boosted({ ...o, p20: 80 }, 2).p20).toBe(95);
    expect(boosted(o, 1)).toBe(o);
  });
});

describe("radar check", () => {
  const o: TorOutlook = {
    now: 10,
    p20: 12,
    p40: 8,
    p60: 5,
    trend: "steady",
    jump: false,
  };
  const read = {
    site: "KTLX",
    age: 4,
    beamFt: 3000,
    miles: 30,
    vrot: 50,
    debris: false,
  };

  it("moves toward the Vrot chance and flags debris", () => {
    expect(vrotChance(15)).toBe(0);
    expect(vrotChance(50)).toBe(58);
    expect(withRadar(o, read).p20).toBe(35);
    expect(withRadar(o, { ...read, debris: true }).p20).toBe(85);
    // Too high, too far or too old: left alone.
    expect(withRadar(o, { ...read, beamFt: 12000 })).toBe(o);
    expect(withRadar(o, { ...read, age: 30 })).toBe(o);
  });

  it("measures range, azimuth and beam height", () => {
    const p = polar({ lat: 35, lon: -97 }, 35.5, -97);
    expect(p.km).toBeCloseTo(55.66, 1);
    expect(p.az).toBeCloseTo(0, 3);
    // 0.5° at 100 km: about 4,800 ft.
    expect(beamFt(100, 0.5)).toBeGreaterThan(4500);
    expect(beamFt(100, 0.5)).toBeLessThan(5100);
  });

  it("finds a cyclonic couplet and its debris ball", () => {
    const rows = 720;
    const gates = 400;
    const mk = (fill: number): Sweep => ({
      moment: "VEL",
      elev: 1,
      angle: 0.5,
      start: 0,
      end: 0,
      rows,
      gates,
      first: 2000,
      spacing: 250,
      scale: 2,
      offset: 129,
      data: new Uint8Array(rows * gates).fill(fill),
      nyquist: 30,
    });
    const code = (v: number) => Math.round(v * 2 + 129);
    const vel = mk(code(0));
    // At 50 km (gate 192) and 90°: inbound 25 m/s, outbound 25 m/s two rows clockwise.
    for (const g of [191, 192, 193]) {
      for (const r of [179, 180]) vel.data[r * gates + g] = code(-25);
      for (const r of [182, 183]) vel.data[r * gates + g] = code(25);
    }
    const ref = { ...mk(code(40)), moment: "REF" as const };
    const rho = { ...mk(0), moment: "RHO" as const, scale: 100, offset: 0 };
    rho.data.fill(98);
    for (const g of [190, 191, 192, 193, 194])
      for (const r of [180, 181, 182]) rho.data[r * gates + g] = 70;
    const c = couplet(vel, 50, 90.6, 8, ref, rho);
    expect(c.vrot).toBe(Math.round(25 * 1.943844));
    expect(c.debris).toBe(true);
    // No debris without the low correlation.
    rho.data.fill(98);
    expect(couplet(vel, 50, 90.6, 8, ref, rho).debris).toBe(false);
  });
});
