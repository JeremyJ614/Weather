/**
 * Sounding analysis: parcel ascent (virtual-temperature corrected), CAPE/CIN for the
 * surface, mixed-layer and most-unstable parcels, lapse rates, moisture, and the wind
 * profile (bulk shear, Bunkers storm motion, storm-relative helicity, STP/SCP). Pure, so
 * the page re-analyzes every forecast hour instantly. Standard formulas: Bolton (1980)
 * saturation vapor pressure and LCL, pseudo-adiabatic ascent integrated in 2 hPa steps,
 * Bunkers et al. (2000) ID method, fixed-layer STP and SCP as SPC defines them.
 */

/** One level: pressure hPa, height m MSL, temperature °C, dew point °C, wind from °, knots. */
export type Level = [
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
];
export type Sounding = { valid: string; fh?: number; levels: Level[] };

const RD = 287.04;
const CP = 1005.7;
const LV = 2.501e6;
const EPS = 0.622;
const G = 9.80665;
const KAPPA = RD / CP;
const MS = 0.514444; // knots → m/s

export const es = (t: number) => 6.112 * Math.exp((17.67 * t) / (t + 243.5));
export const mix = (t: number, p: number) => (EPS * es(t)) / (p - es(t));
const tv = (tk: number, w: number) => tk * (1 + 0.61 * w);

/** Lifting condensation level from a parcel's T and Td (°C) at p (Bolton 1980). */
export function lcl(t: number, td: number, p: number) {
  const tk = t + 273.15;
  const dk = Math.min(td, t) + 273.15;
  const tl = 1 / (1 / (dk - 56) + Math.log(tk / dk) / 800) + 56;
  return { t: tl - 273.15, p: p * (tl / tk) ** (1 / KAPPA) };
}

/** Pseudo-adiabatic dT/dp (K per hPa) for a saturated parcel. */
function moistRate(tk: number, p: number) {
  const w = mix(tk - 273.15, p);
  return (RD * tk + LV * w) / (p * (CP + (LV * LV * w * EPS) / (RD * tk * tk)));
}

/** A parcel's temperature (°C) and mixing ratio at every pressure in `ps`. */
export function parcelPath(t0: number, td0: number, p0: number, ps: number[]) {
  const base = lcl(t0, td0, p0);
  const theta = (t0 + 273.15) * (1000 / p0) ** KAPPA;
  const w0 = mix(Math.min(td0, t0), p0);
  // Moist curve from the LCL up, every 2 hPa (RK2), interpolated per level.
  const curve: [number, number][] = [[base.p, base.t + 273.15]];
  for (let p = base.p, tk = base.t + 273.15; p > 50;) {
    const dp = -Math.min(2, p - 50);
    const k1 = moistRate(tk, p);
    const k2 = moistRate(tk + k1 * dp, p + dp);
    tk += ((k1 + k2) / 2) * dp;
    p += dp;
    curve.push([p, tk]);
  }
  return ps.map((p) => {
    if (p >= base.p) {
      const tk = theta * (p / 1000) ** KAPPA;
      return { t: tk - 273.15, w: w0 };
    }
    const i = Math.min(
      curve.length - 1,
      Math.max(1, Math.ceil((base.p - p) / 2)),
    );
    const [pa, ta] = curve[i - 1];
    const [pb, tb] = curve[i];
    const f = pa === pb ? 0 : (pa - p) / (pa - pb);
    const tk = ta + (tb - ta) * Math.max(0, Math.min(1, f));
    return { t: tk - 273.15, w: mix(tk - 273.15, p) };
  });
}

/** Valid thermodynamic levels, surface first, up to 100 hPa. */
export function clean(levels: Level[]): Level[] {
  return levels
    .filter(
      (l) => l[0] >= 100 && Number.isFinite(l[2]) && Number.isFinite(l[1]),
    )
    .sort((a, b) => b[0] - a[0]);
}

export type Parcel = {
  cape: number;
  cin: number;
  /** CAPE below 3 km AGL. */
  cape3: number;
  lclM: number;
  lfcM: number | null;
  elM: number | null;
  /** Lifted index at 500 hPa. */
  li: number | null;
  /** Where the parcel starts (hPa). */
  p0: number;
  /** The parcel's temperature at each level (for drawing). */
  path: number[];
};

function lift(L: Level[], t0: number, td0: number, p0: number): Parcel {
  const ps = L.map((l) => l[0]);
  const path = parcelPath(t0, td0, p0, ps);
  const sfcZ = L[0][1];
  const base = lcl(t0, td0, p0);
  const zAt = (p: number) => interpLogP(L, p, 1);
  const B = L.map((l, i) => {
    if (l[0] > p0) return 0;
    const we = l[3] == null ? 0 : mix(Math.min(l[3], l[2]), l[0]);
    const te = tv(l[2] + 273.15, we);
    return (G * (tv(path[i].t + 273.15, path[i].w) - te)) / te;
  });
  const lclZ = zAt(base.p);
  // Parcel starts at p0: skip levels below it (MU parcels start aloft).
  const start = Math.max(
    0,
    L.findIndex((l) => l[0] <= p0),
  );
  let cape = 0;
  let cin = 0;
  let cape3 = 0;
  let lfc: number | null = null;
  let el: number | null = null;
  // Top of the highest positive layer = EL; LFC = bottom of the lowest positive layer at or
  // above the LCL; CIN = negative area below the LFC.
  for (let i = L.length - 1; i > start; i--) {
    if (B[i] > 0 || B[i - 1] > 0) {
      el = B[i] > 0 ? L[i][1] : cross(L[i - 1][1], L[i][1], B[i - 1], B[i]);
      break;
    }
  }
  if (el != null) {
    for (let i = start + 1; i < L.length; i++) {
      if (L[i][1] < lclZ || B[i] <= 0) continue;
      const z0 = L[i - 1][1];
      lfc = Math.max(
        lclZ,
        B[i - 1] > 0 ? z0 : cross(z0, L[i][1], B[i - 1], B[i]),
      );
      break;
    }
  }
  const top = sfcZ + 3000;
  for (let i = start + 1; i < L.length; i++) {
    const z0 = L[i - 1][1];
    const z1 = L[i][1];
    const area = layer(z0, z1, B[i - 1], B[i]);
    if (lfc != null && el != null && z1 > lfc && z0 < el) {
      cape += area.pos;
      if (z0 < top)
        cape3 += area.pos * Math.min(1, (top - z0) / Math.max(1, z1 - z0));
    }
    if (lfc != null && z0 < lfc) cin += area.neg;
  }
  const i500 = ps.findIndex((p) => p <= 500);
  const li = i500 > 0 ? interpP(L, 500, 2) - interpPath(ps, path, 500) : null;
  return {
    cape: Math.round(cape),
    cin: lfc == null ? 0 : Math.round(cin),
    cape3: Math.round(cape3),
    lclM: Math.max(0, Math.round(lclZ - sfcZ)),
    lfcM: lfc == null ? null : Math.round(lfc - sfcZ),
    elM: el == null || lfc == null ? null : Math.round(el - sfcZ),
    li: li == null ? null : Math.round(li * 10) / 10,
    p0,
    path: path.map((x) => Math.round(x.t * 10) / 10),
  };
}

const cross = (z0: number, z1: number, b0: number, b1: number) =>
  z0 + ((z1 - z0) * b0) / (b0 - b1);

/** Positive and negative buoyancy areas (J/kg) of one layer, split at a sign change. */
function layer(z0: number, z1: number, b0: number, b1: number) {
  const dz = z1 - z0;
  if (b0 >= 0 && b1 >= 0) return { pos: ((b0 + b1) / 2) * dz, neg: 0 };
  if (b0 <= 0 && b1 <= 0) return { pos: 0, neg: ((b0 + b1) / 2) * dz };
  const zc = cross(z0, z1, b0, b1) - z0;
  const a = (b0 / 2) * zc;
  const b = (b1 / 2) * (dz - zc);
  return b0 > 0 ? { pos: a, neg: b } : { pos: b, neg: a };
}

function interpLogP(L: Level[], p: number, col: 1 | 2) {
  for (let i = 1; i < L.length; i++) {
    if (L[i][0] <= p) {
      const f =
        Math.log(L[i - 1][0] / p) / Math.log(L[i - 1][0] / L[i][0] || 1);
      return L[i - 1][col] + (L[i][col] - L[i - 1][col]) * f;
    }
  }
  return L[L.length - 1][col];
}
const interpP = interpLogP;
function interpPath(ps: number[], path: { t: number }[], p: number) {
  for (let i = 1; i < ps.length; i++)
    if (ps[i] <= p) {
      const f = Math.log(ps[i - 1] / p) / Math.log(ps[i - 1] / ps[i] || 1);
      return path[i - 1].t + (path[i].t - path[i - 1].t) * f;
    }
  return path[path.length - 1].t;
}

/** Temperature (°C) at a height AGL (m), linear in height. */
function tAtZ(L: Level[], zAgl: number) {
  const z = L[0][1] + zAgl;
  for (let i = 1; i < L.length; i++)
    if (L[i][1] >= z) {
      const f = (z - L[i - 1][1]) / (L[i][1] - L[i - 1][1] || 1);
      return L[i - 1][2] + (L[i][2] - L[i - 1][2]) * f;
    }
  return null;
}

/** Pressure (hPa) at a height AGL (m), log-linear between levels. */
export function pAtZ(L: Level[], zAgl: number) {
  const z = L[0][1] + zAgl;
  for (let i = 1; i < L.length; i++)
    if (L[i][1] >= z) {
      const f = (z - L[i - 1][1]) / (L[i][1] - L[i - 1][1] || 1);
      return Math.exp(
        Math.log(L[i - 1][0]) + (Math.log(L[i][0]) - Math.log(L[i - 1][0])) * f,
      );
    }
  return L[L.length - 1][0];
}

export type Wind = { z: number; u: number; v: number };

/** u/v (knots) every 250 m AGL from the surface to 12 km, where winds exist. */
export function windProfile(levels: Level[]): Wind[] {
  const W = levels
    .filter((l) => l[4] != null && l[5] != null)
    .sort((a, b) => a[1] - b[1]);
  if (W.length < 2) return [];
  const sfc = clean(levels)[0]?.[1] ?? W[0][1];
  const comp = W.map((l) => {
    const r = ((l[4] as number) * Math.PI) / 180;
    return {
      z: l[1] - sfc,
      u: -(l[5] as number) * Math.sin(r),
      v: -(l[5] as number) * Math.cos(r),
    };
  });
  const out: Wind[] = [];
  for (let z = 0; z <= 12000; z += 250) {
    const j = comp.findIndex((c) => c.z >= z);
    if (j < 0) break;
    if (j === 0) {
      if (comp[0].z - z > 400) continue;
      out.push({ z, u: comp[0].u, v: comp[0].v });
      continue;
    }
    const a = comp[j - 1];
    const b = comp[j];
    const f = (z - a.z) / (b.z - a.z || 1);
    out.push({ z, u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f });
  }
  return out;
}

const at = (w: Wind[], z: number) => w.find((x) => x.z >= z);
const mean = (w: Wind[], z0: number, z1: number) => {
  const s = w.filter((x) => x.z >= z0 && x.z <= z1);
  return s.length
    ? {
        u: s.reduce((a, x) => a + x.u, 0) / s.length,
        v: s.reduce((a, x) => a + x.v, 0) / s.length,
      }
    : null;
};

/** Bunkers right- and left-mover (knots) by the ID method. */
export function bunkers(w: Wind[]) {
  const m = mean(w, 0, 6000);
  const lo = mean(w, 0, 500);
  const hi = mean(w, 5500, 6000);
  if (!m || !lo || !hi) return null;
  const su = hi.u - lo.u;
  const sv = hi.v - lo.v;
  const s = Math.hypot(su, sv) || 1;
  const d = 7.5 / MS;
  return {
    rm: { u: m.u + (d * sv) / s, v: m.v - (d * su) / s },
    lm: { u: m.u - (d * sv) / s, v: m.v + (d * su) / s },
    mean: m,
  };
}

/** Storm-relative helicity (m²/s²) from the surface to `top` m AGL. */
export function srh(w: Wind[], top: number, storm: { u: number; v: number }) {
  let h = 0;
  const s = w.filter((x) => x.z <= top);
  for (let i = 1; i < s.length; i++) {
    const [u0, v0] = [(s[i - 1].u - storm.u) * MS, (s[i - 1].v - storm.v) * MS];
    const [u1, v1] = [(s[i].u - storm.u) * MS, (s[i].v - storm.v) * MS];
    h += u1 * v0 - u0 * v1;
  }
  return Math.round(h);
}

const shear = (w: Wind[], top: number) => {
  const a = at(w, 0);
  const b = at(w, top);
  return a && b && b.z - top < 300
    ? Math.round(Math.hypot(b.u - a.u, b.v - a.v))
    : null;
};

export type Analysis = {
  sb: Parcel;
  ml: Parcel;
  mu: Parcel & { fromM: number };
  lapse03: number | null;
  lapse75: number | null;
  pwatIn: number;
  frzFt: number | null;
  shear1: number | null;
  shear3: number | null;
  shear6: number | null;
  srh1: number | null;
  srh3: number | null;
  rm: { u: number; v: number } | null;
  lm: { u: number; v: number } | null;
  mean: { u: number; v: number } | null;
  stp: number | null;
  scp: number | null;
  wind: Wind[];
  levels: Level[];
};

/** Everything the page shows for one sounding; null if it has too few levels. */
export function analyze(raw: Level[]): Analysis | null {
  const L = clean(raw).filter((l) => l[3] != null || l[0] < 500);
  if (L.length < 8 || L[0][3] == null) return null;
  const [p0, , t0, td0] = L[0] as unknown as [number, number, number, number];
  const sb = lift(L, t0, td0, p0);

  // Mixed layer: mean potential temperature and mixing ratio over the lowest 100 hPa.
  const low = L.filter((l) => l[0] >= p0 - 100 && l[3] != null);
  const th =
    low.reduce((a, l) => a + (l[2] + 273.15) * (1000 / l[0]) ** KAPPA, 0) /
    low.length;
  const wm =
    low.reduce((a, l) => a + mix(l[3] as number, l[0]), 0) / low.length;
  const tml = th * (p0 / 1000) ** KAPPA - 273.15;
  const e = (wm * p0) / (EPS + wm);
  const tdml = (243.5 * Math.log(e / 6.112)) / (17.67 - Math.log(e / 6.112));
  const ml = lift(L, tml, Math.min(tdml, tml), p0);

  // Most unstable: highest θe in the lowest 300 hPa.
  let best = L[0];
  let bestTe = -Infinity;
  for (const l of L) {
    if (l[0] < p0 - 300 || l[3] == null) continue;
    const c = lcl(l[2], l[3], l[0]);
    const te =
      (l[2] + 273.15) *
      (1000 / l[0]) ** KAPPA *
      Math.exp((LV * mix(l[3], l[0])) / (CP * (c.t + 273.15)));
    if (te > bestTe) {
      bestTe = te;
      best = l;
    }
  }
  // Highest θe usually gives the most CAPE; when a shallow layer wins θe but not
  // buoyancy, the surface parcel is the most unstable one.
  const top = lift(L, best[2], best[3] as number, best[0]);
  const mu =
    top.cape >= sb.cape
      ? { ...top, fromM: Math.round(best[1] - L[0][1]) }
      : { ...sb, fromM: 0 };

  const t3 = tAtZ(L, 3000);
  const t700 = interpP(L, 700, 2);
  const t500 = interpP(L, 500, 2);
  const z700 = interpP(L, 700, 1);
  const z500 = interpP(L, 500, 1);
  let pw = 0;
  for (let i = 1; i < L.length && L[i][0] >= 300; i++) {
    const a = L[i - 1];
    const b = L[i];
    if (a[3] == null || b[3] == null) continue;
    pw += ((mix(a[3], a[0]) + mix(b[3], b[0])) / 2) * (a[0] - b[0]) * (100 / G);
  }
  let frz: number | null = L[0][2] <= 0 ? 0 : null;
  for (let i = 1; i < L.length && frz == null; i++)
    if (L[i][2] <= 0)
      frz = cross(L[i - 1][1], L[i][1], L[i - 1][2], L[i][2]) - L[0][1];

  const wind = windProfile(raw);
  const bk = wind.length ? bunkers(wind) : null;
  const s6 = shear(wind, 6000);
  const r1 = bk ? srh(wind, 1000, bk.rm) : null;
  const r3 = bk ? srh(wind, 3000, bk.rm) : null;
  const s6ms = s6 == null ? null : s6 * MS;
  const stp =
    r1 == null || s6ms == null
      ? null
      : (sb.cape / 1500) *
        (sb.lclM < 1000 ? 1 : sb.lclM > 2000 ? 0 : (2000 - sb.lclM) / 1000) *
        (r1 / 150) *
        (s6ms < 12.5 ? 0 : Math.min(1.5, s6ms / 20)) *
        (sb.cin > -50 ? 1 : sb.cin < -200 ? 0 : (200 + sb.cin) / 150);
  const scp =
    r3 == null || s6ms == null
      ? null
      : (mu.cape / 1000) * (r3 / 50) * (s6ms < 10 ? 0 : Math.min(1, s6ms / 20));
  const r = (v: number | null, d = 1) =>
    v == null ? null : Math.round(v * 10 ** d) / 10 ** d;
  return {
    sb,
    ml,
    mu,
    lapse03: t3 == null ? null : r((L[0][2] - t3) / 3),
    lapse75: z500 > z700 ? r(((t700 - t500) / (z500 - z700)) * 1000) : null,
    pwatIn: Math.round((pw / 25.4) * 100) / 100,
    frzFt: frz == null ? null : Math.round((frz * 3.28084) / 100) * 100,
    shear1: shear(wind, 1000),
    shear3: shear(wind, 3000),
    shear6: s6,
    srh1: r1,
    srh3: r3,
    rm: bk?.rm ?? null,
    lm: bk?.lm ?? null,
    mean: bk?.mean ?? null,
    stp: r(stp == null ? null : Math.max(0, stp)),
    scp: r(scp == null ? null : Math.max(0, scp)),
    wind,
    levels: L,
  };
}
