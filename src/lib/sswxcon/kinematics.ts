/**
 * Storm-relative helicity and deep-layer shear from a few pressure levels
 * (ported from the VIP app's weatherCalc). Winds in m/s, results in knots
 * (shear) and m²/s² (SRH, the VIP approximation).
 */

const KT = 1.94384;

export function uv(speedMs: number, dirDeg: number): [number, number] {
  const k = speedMs * KT;
  const r = (dirDeg * Math.PI) / 180;
  return [-k * Math.sin(r), -k * Math.cos(r)];
}

/** Bunkers-style right mover from the mean wind, as VIP estimated it. */
export function stormMotion(levels: [number, number][]): [number, number] {
  const u = levels.reduce((a, l) => a + l[0], 0) / levels.length;
  const v = levels.reduce((a, l) => a + l[1], 0) / levels.length;
  const spd = Math.hypot(u, v);
  if (spd < 0.5) return [2.5, 2.5];
  const ang = Math.atan2(u, v) + Math.PI / 6;
  const dev = Math.min(7.5, spd * 0.4);
  return [u + dev * Math.sin(ang), v + dev * Math.cos(ang)];
}

export type Profile = {
  /** [speed m/s, direction °] at 10 m, 925, 850, 700 and 500 hPa. */
  w10: [number, number];
  w925: [number, number];
  w850: [number, number];
  w700: [number, number];
  w500: [number, number];
};

export function srh(p: Profile): number {
  const l10 = uv(...p.w10);
  const l925 = uv(...p.w925);
  const l850 = uv(...p.w850);
  const l700 = uv(...p.w700);
  const l500 = uv(...p.w500);
  const [su, sv] = stormMotion([l500, l850, l925]);
  const layers = [l10, l925, l850, l700];
  let h = 0;
  for (let i = 0; i < layers.length - 1; i++) {
    const [u0, v0] = [layers[i][0] - su, layers[i][1] - sv];
    const [u1, v1] = [layers[i + 1][0] - su, layers[i + 1][1] - sv];
    h += u0 * v1 - u1 * v0;
  }
  return Math.abs(h);
}

/**
 * Shear (kt) and helicity in the lowest layer: 10 m to 925 hPa, or to 850 hPa on high
 * ground where 925 hPa is underground (about 0–1 km).
 */
export function lowLayer(p: Profile, high = false) {
  const top = uv(...(high ? p.w850 : p.w925));
  const bottom = uv(...p.w10);
  const [su, sv] = stormMotion([uv(...p.w500), uv(...p.w850), uv(...p.w925)]);
  const [u0, v0] = [bottom[0] - su, bottom[1] - sv];
  const [u1, v1] = [top[0] - su, top[1] - sv];
  return {
    shear: Math.hypot(top[0] - bottom[0], top[1] - bottom[1]),
    srh: Math.abs(u0 * v1 - u1 * v0),
  };
}

export function shear06(p: Profile): number {
  const [u0, v0] = uv(...p.w10);
  const [u1, v1] = uv(...p.w500);
  return Math.hypot(u1 - u0, v1 - v0);
}

/** VIP's local instability points (0–12), now shown beside the national score. */
export function localPoints(
  cape: number,
  srhV: number,
  shear: number,
  li: number,
) {
  return (
    Math.round(
      Math.min(
        12,
        (cape > 0 ? Math.min(3, cape / 1000) : 0) +
          (srhV > 0 ? Math.min(3, srhV / 150) : 0) +
          (shear > 0 ? Math.min(3, shear / 25) : 0) +
          (li < 0 ? Math.min(3, -li / 3) : 0),
      ) * 10,
    ) / 10
  );
}
