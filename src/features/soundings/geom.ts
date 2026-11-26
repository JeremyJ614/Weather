/**
 * Skew-T and hodograph geometry as SVG path data, shared by the page's SVG charts and the
 * share cards' canvas (Path2D reads the same strings), so both always match. The Skew-T
 * shades CAPE (parcel warmer than the air, LFC to EL) and CIN (parcel colder, from where it
 * starts up to the LFC: the cap) (owner's list #41).
 */
import {
  parcelPath,
  pAtZ,
  type Analysis,
  type Level,
  type Parcel,
} from "@/lib/soundings/thermo";
import { SND_BANDS } from "@/lib/soundings/style";

export const SK_W = 340;
export const SK_H = 420;
const P0 = 1050;
const P1 = 100;
const TMIN = -40;
const TSPAN = 90;
const KAPPA = 0.2857;
export const PRESS = [1000, 850, 700, 500, 400, 300, 250, 200, 150, 100];

export const skY = (p: number) =>
  SK_H * (1 - Math.log(P0 / p) / Math.log(P0 / P1));
/** Pressure at a chart height (the inverse of skY). */
export const skP = (y: number) =>
  P0 / Math.exp((1 - y / SK_H) * Math.log(P0 / P1));
/** Isotherms lean right going up (0.75 px per px), so the troposphere stands near upright. */
export const skX = (t: number, p: number) =>
  ((t - TMIN) / TSPAN) * SK_W + (SK_H - skY(p)) * 0.75;
/** Temperature at a chart point (the inverse of skX). */
export const skT = (x: number, p: number) =>
  ((x - (SK_H - skY(p)) * 0.75) / SK_W) * TSPAN + TMIN;

export const path = (pts: [number, number][]) =>
  pts
    .map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`)
    .join("");

let grid: {
  iso: { t: number; d: string }[];
  dry: string[];
  moist: string[];
} | null = null;
/** The static background: isotherms, dry and moist adiabats. Built once. */
export function skewGrid() {
  if (grid) return grid;
  const ps = Array.from({ length: 39 }, (_, i) => P0 - i * 25);
  const iso = Array.from({ length: 16 }, (_, i) => -100 + i * 10).map((t) => ({
    t,
    d: path([
      [skX(t, P0), skY(P0)],
      [skX(t, P1), skY(P1)],
    ]),
  }));
  const dry = Array.from({ length: 18 }, (_, i) => 250 + i * 10).map((th) =>
    path(ps.map((p) => [skX(th * (p / 1000) ** KAPPA - 273.15, p), skY(p)])),
  );
  const moist = [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35].map((t) => {
    const up = ps.filter((p) => p <= 1000 && p >= 200);
    return path(
      parcelPath(t, t, 1000, up).map((q, i) => [skX(q.t, up[i]), skY(up[i])]),
    );
  });
  grid = { iso, dry, moist };
  return grid;
}

export type SkewPaths = {
  temp: string;
  dew: string;
  par: string;
  cape: string;
  cin: string;
  /** LCL, LFC, EL at their chart heights. */
  marks: [string, number][];
  barbs: { y: number; dir: number; kt: number }[];
  /** Where to label the shaded areas (chart units), when they show. */
  capeAt: [number, number] | null;
  cinAt: [number, number] | null;
};

/** The area between the parcel and the air over a band of levels, on the side `f` picks. */
function between(
  band: { p: number; t: number; tp: number }[],
  f: (tp: number, t: number) => number,
) {
  if (band.length < 2) return "";
  return (
    path(band.map((q) => [skX(f(q.tp, q.t), q.p), skY(q.p)])) +
    path([...band].reverse().map((q) => [skX(q.t, q.p), skY(q.p)])).replace(
      /^M/,
      "L",
    ) +
    "Z"
  );
}

export function skewPaths(a: Analysis, parcel: Parcel): SkewPaths {
  const L = a.levels;
  const temp = path(L.map((l) => [skX(l[2], l[0]), skY(l[0])]));
  const dew = path(
    L.filter((l) => l[3] != null && l[0] >= 200).map((l) => [
      skX(l[3] as number, l[0]),
      skY(l[0]),
    ]),
  );
  const pi = L.map((l, i) => [l[0], parcel.path[i]] as const).filter(
    ([p]) => p <= parcel.p0,
  );
  const par = path(pi.map(([p, t]) => [skX(t, p), skY(p)]));
  const rows = L.map((l, i) => ({ p: l[0], t: l[2], tp: parcel.path[i] }));
  let cape = "";
  let cin = "";
  let capeAt: [number, number] | null = null;
  let cinAt: [number, number] | null = null;
  if (parcel.lfcM != null) {
    const lfc = pAtZ(L, parcel.lfcM);
    if (parcel.cape > 10 && parcel.elM != null) {
      const el = pAtZ(L, parcel.elM);
      const band = rows.filter((q) => q.p <= lfc && q.p >= el);
      cape = between(band, Math.max);
      const mid = band[Math.floor(band.length / 2)];
      if (mid) capeAt = [skX((mid.t + mid.tp) / 2, mid.p), skY(mid.p)];
    }
    if (parcel.cin < -1) {
      const band = rows.filter((q) => q.p <= parcel.p0 && q.p >= lfc);
      cin = between(band, Math.min);
      // Label beside the widest part of the cap.
      const wide = band.reduce<(typeof band)[number] | null>(
        (b, q) => (!b || q.t - q.tp > b.t - b.tp ? q : b),
        null,
      );
      if (wide) cinAt = [skX(wide.tp, wide.p), skY(wide.p)];
    }
  }
  const marks = (
    [
      ["LCL", parcel.lclM],
      ["LFC", parcel.lfcM],
      ["EL", parcel.elM],
    ] as [string, number | null][]
  )
    .filter((m): m is [string, number] => m[1] != null)
    .map(([k, m]) => [k, skY(pAtZ(L, m))] as [string, number]);
  const barbs = [
    1000, 950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300,
    250, 200, 150, 100,
  ]
    .map((p) =>
      L.reduce(
        (b, l) => (Math.abs(l[0] - p) < Math.abs(b[0] - p) ? l : b),
        L[0],
      ),
    )
    .filter(
      (l, i, arr) =>
        l[4] != null && l[5] != null && arr.indexOf(l) === i && l[0] >= P1,
    )
    .map((l) => ({ y: skY(l[0]), dir: l[4] as number, kt: l[5] as number }));
  return { temp, dew, par, cape, cin, marks, barbs, capeAt, cinAt };
}

/**
 * One wind barb (knots) as path data from the origin with the staff pointing up (rotate by
 * the wind's direction): pennants are closed (fill them), barbs are lines. Calm is a circle.
 */
export function barbPath(kt: number) {
  if (kt < 2.5) return "M3 0A3 3 0 1 1 -3 0A3 3 0 1 1 3 0";
  let k = Math.round(kt / 5) * 5;
  const parts: string[] = [];
  let pos = 22;
  while (k >= 50) {
    parts.push(`M0 ${-pos}L9 ${-pos + 3}L0 ${-pos + 6}Z`);
    pos -= 7;
    k -= 50;
  }
  while (k >= 10) {
    parts.push(`M0 ${-pos}L10 ${-pos - 4}`);
    pos -= 4;
    k -= 10;
  }
  if (k >= 5)
    parts.push(
      `M0 ${-pos + (pos === 22 ? 4 : 0)}L5 ${-pos - 2 + (pos === 22 ? 4 : 0)}`,
    );
  return `M0 0L0 -22${parts.join("")}`;
}

/** Log-pressure interpolation of a level's fields at pressure p. */
export function levelAt(L: Level[], p: number) {
  const lo = L.findIndex((l) => l[0] <= p);
  if (lo <= 0) return { i: Math.max(0, lo), f: 0, j: Math.max(0, lo) };
  const a = L[lo - 1];
  const b = L[lo];
  const f =
    (Math.log(a[0]) - Math.log(p)) / (Math.log(a[0]) - Math.log(b[0]) || 1);
  return { i: lo - 1, j: lo, f };
}

/** Everything about the air at pressure p, for the tap-for-details readout. */
export function readAt(a: Analysis, parcel: Parcel, p: number) {
  const L = a.levels;
  const top = L[L.length - 1][0];
  const pp = Math.min(L[0][0], Math.max(top, p));
  const { i, j, f } = levelAt(L, pp);
  const lerp = (x: number | null, y: number | null) =>
    x == null || y == null ? (x ?? y) : x + (y - x) * f;
  const t = lerp(L[i][2], L[j][2]) as number;
  const td = lerp(L[i][3], L[j][3]);
  const zMsl = lerp(L[i][1], L[j][1]) as number;
  const z = zMsl - L[0][1];
  const tp = pp <= parcel.p0 ? lerp(parcel.path[i], parcel.path[j]) : null;
  // Wind from the profile at this height.
  const w = a.wind.find((q) => q.z >= z) ?? a.wind[a.wind.length - 1];
  const kt = w ? Math.round(Math.hypot(w.u, w.v)) : null;
  const dir = w
    ? Math.round(((Math.atan2(-w.u, -w.v) * 180) / Math.PI + 360) % 360)
    : null;
  const rh =
    td == null
      ? null
      : Math.round(
          100 *
            Math.exp(
              (17.625 * td) / (243.04 + td) - (17.625 * t) / (243.04 + t),
            ),
        );
  // Lapse rate over the kilometer around this height.
  const tAtZ = (zz: number) => {
    const target = L[0][1] + zz;
    const k = L.findIndex((l) => l[1] >= target);
    if (k < 0) return null;
    if (k === 0) return L[0][2];
    const ff = (target - L[k - 1][1]) / (L[k][1] - L[k - 1][1] || 1);
    return L[k - 1][2] + (L[k][2] - L[k - 1][2]) * ff;
  };
  const z0 = Math.max(0, z - 500);
  const z1 = z + 500;
  const tb = tAtZ(z0);
  const tt = tAtZ(z1);
  const lapse =
    tb != null && tt != null
      ? Math.round(((tb - tt) / (z1 - z0)) * 10000) / 10
      : null;
  const inCape =
    parcel.lfcM != null &&
    parcel.elM != null &&
    z >= parcel.lfcM &&
    z <= parcel.elM;
  const inCin = tp != null && parcel.lfcM != null && z < parcel.lfcM && tp < t;
  const zone =
    z < parcel.lclM
      ? "Below cloud base: rising air is still dry"
      : inCape
        ? "CAPE layer: a rising parcel is warmer than the air, so it accelerates up"
        : inCin
          ? "The cap (CIN): a rising parcel is colder than the air, so it has to be pushed"
          : parcel.elM != null && z > parcel.elM
            ? "Above the equilibrium level: storm tops spread out here"
            : "Inside the cloud, not buoyant";
  return {
    p: Math.round(pp),
    z: Math.round(z),
    t,
    td,
    tp,
    buoy: tp == null ? null : tp - t,
    rh,
    dir,
    kt,
    lapse,
    zone,
    inCape,
    inCin,
  };
}

/** Hodograph geometry (knots) in a size×size box: rings, bands, the SRH wedge and movers. */
export function hodoGeom(a: Analysis, size = 300, fixed?: number) {
  const C = size / 2;
  const w = a.wind.filter((p) => p.z <= 12000);
  const max = Math.max(
    40,
    ...w.map((p) => Math.hypot(p.u, p.v)),
    ...(a.rm ? [Math.hypot(a.rm.u, a.rm.v)] : []),
  );
  const ring = fixed ?? Math.ceil(max / 10) * 10;
  const k = (C - 14) / ring;
  const X = (u: number) => C + u * k;
  const Y = (v: number) => C - v * k;
  const bands = SND_BANDS.map((b, i) => {
    const lo = i ? SND_BANDS[i - 1].top : 0;
    const pts = w.filter((p) => p.z >= lo && p.z <= b.top);
    return {
      key: b.key,
      d: pts
        .map(
          (p, j) => `${j ? "L" : "M"}${X(p.u).toFixed(1)} ${Y(p.v).toFixed(1)}`,
        )
        .join(""),
    };
  });
  const srhPts = a.rm ? w.filter((p) => p.z <= 1000) : [];
  const srh =
    srhPts.length > 1 && a.rm
      ? `M${X(a.rm.u)} ${Y(a.rm.v)}${srhPts.map((p) => `L${X(p.u).toFixed(1)} ${Y(p.v).toFixed(1)}`).join("")}Z`
      : "";
  const step = ring > 80 ? 20 : 10;
  const rings = Array.from({ length: ring / step }, (_, i) => (i + 1) * step);
  const ticks = [1000, 3000, 6000, 9000]
    .map((z) => w.find((p) => p.z === z))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ x: X(p.u), y: Y(p.v), label: String(p.z / 1000) }));
  return {
    C,
    k,
    ring,
    rings,
    bands,
    srh,
    ticks,
    enough: w.length >= 3,
    rm: a.rm ? { x: X(a.rm.u), y: Y(a.rm.v) } : null,
    lm: a.lm ? { x: X(a.lm.u), y: Y(a.lm.v) } : null,
    mean: a.mean ? { x: X(a.mean.u), y: Y(a.mean.v) } : null,
  };
}
