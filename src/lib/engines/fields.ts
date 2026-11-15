import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import {
  gridSize,
  locator,
  type Field,
  type LatLonGrid,
} from "@/lib/models/grib2";
import {
  MODELS,
  REGIONS,
  exists,
  latestCycle,
  record,
} from "@/lib/models/render";
import { activeFires } from "@/lib/fire/data";
import { nextSunEvent, sunPosition } from "@/lib/sky/astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOutlook } from "@/lib/tropical/nhc";
import { latticeAreas, soften } from "./areas";
import { FIELD_BANDS, PROB_BANDS, type FieldId } from "./colors";
import { nationalStrikes } from "@/lib/lightning/data";
import { LT_CLASSES } from "@/lib/lightning/style";
import { decodePng } from "@/lib/lightning/png";
import { readJson, writeJson } from "@/lib/ops/store";
import { logFlags, type Flag } from "./verify";
import { bound } from "./boundary";
import {
  glowFactors,
  glowScore,
  type GlowInputs,
  type Weights,
} from "./outdoor";

/**
 * The model-driven Weather Engines (Extras). Each reads a handful of HRRR fields by byte range
 * from NOAA's AWS archive (the same reader as the model viewer) and combines them into one
 * index, painted as a transparent map layer in the admin-editable band colors.
 */
export const CONUS = REGIONS.conus.b;
const KT = 1.943844;
let places: ReturnType<typeof parsePlaces> | null = null;

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const hypot = (a: Float32Array, b: Float32Array) => {
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = Math.hypot(a[i], b[i]);
  return o;
};
export const cycleTime = (c: string) =>
  Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8));

/** The forecast hour of `cycle` closest to `at`, inside the HRRR's 18 hours. */
export const hourFor = (cycle: string, at: number) =>
  clamp(Math.round((at - cycleTime(cycle)) / 3600_000), 0, 18);

/** The next time it is `hour`:00 UTC, at least `ahead` hours from now. */
function nextUtc(hour: number, ahead = 0) {
  const t = new Date(Date.now() + ahead * 3600_000);
  t.setUTCMinutes(0, 0, 0);
  while (t.getUTCHours() !== hour) t.setTime(t.getTime() + 3600_000);
  return t.getTime();
}

/** The newest 48-hour HRRR run (00, 06, 12 or 18Z) at or before `cycle` with its last hour out. */
async function longRun(cycle: string) {
  for (let back = 0; back <= 12; back++) {
    const t = cycleTime(cycle) - back * 3600_000;
    const d = new Date(t);
    if (d.getUTCHours() % 6) continue;
    const id = d.toISOString().slice(0, 13).replace(/[-T]/g, "");
    if (await exists(MODELS.hrrr.url(id.slice(0, 8), id.slice(8), 48)))
      return id;
  }
  return null;
}

export async function grab(cycle: string, fh: number, matches: string[]) {
  const url = MODELS.hrrr.url(cycle.slice(0, 8), cycle.slice(8), fh);
  return Promise.all(matches.map((m) => record(url, m)));
}

/** Saturated θe at 1000 hPa by temperature, for turning θe into θw by table lookup. */
const THW = (() => {
  const out: number[] = [];
  for (let t = 220; t <= 320; t += 0.05) out.push(thetaE(t, t, 100000));
  return out;
})();
function thetaW(te: number) {
  let lo = 0;
  let hi = THW.length - 1;
  if (!(te > THW[0])) return 220;
  if (te >= THW[hi]) return 320;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (THW[m] < te) lo = m;
    else hi = m;
  }
  return 220 + lo * 0.05;
}
/** Bolton (1980) θe (K) from T and Td (K) and pressure (Pa). */
function thetaE(t: number, td: number, p: number) {
  const hpa = p / 100;
  const e = 6.112 * Math.exp((17.67 * (td - 273.15)) / (td - 29.65));
  const r = (0.622 * e) / Math.max(hpa - e, 1e-3);
  const tl = 56 + 1 / (1 / (td - 56) + Math.log(t / td) / 800);
  const th =
    t * (1000 / Math.max(hpa - e, 1e-3)) ** 0.2854 * (t / tl) ** (0.28 * r);
  return th * Math.exp((3036 / tl - 1.78) * r * (1 + 0.448 * r));
}
const es = (tc: number) => 6.112 * Math.exp((17.67 * tc) / (tc + 243.5));
export type Computed = {
  field: Field;
  cycle: string;
  fh: number;
  keep?: (lat: number, lon: number) => boolean;
  extra?: Record<string, unknown>;
  note?: string;
  /** A field noisy cell to cell (terrain-driven), softened twice before contouring. */
  rough?: boolean;
  /** Places to check against the weather later (from the top spots). */
  flags?: (spots: Spot[]) => Flag[];
  /** A line under each listed spot (why), and its time (shown in the viewer's zone). */
  detail?: (lat: number, lon: number) => string | undefined;
  when?: (lat: number, lon: number) => number | undefined;
  altWhen?: (lat: number, lon: number) => number | undefined;
  /** Listed spots must be this close to a U.S. town (default 100 miles). */
  nearMiles?: number;
  /** The line under each spot listed for the second map (only maps that list spots). */
  altDetail?: (lat: number, lon: number) => string | undefined;
  /** A second map of the same engine, with its own bands (First Storms' timing). */
  alt?: { field: Field; levels: number[] };
};

/**
 * Nocturnal LLJ Ramp-Up, valid at the coming 06Z (about 1 a.m. Central). Post-launch A6: a
 * true jet has a wind peak low down and a falloff above it (the Bonner criteria, from the
 * 925, 850 and 700 mb winds), broad flow without that counts half; the moisture the jet
 * carries (850 mb mixing ratio × wind) weighs in; each top spot says when the jet peaks
 * (03Z, 06Z or 09Z) and how strong it gets.
 */
async function llj(cycle: string): Promise<Computed> {
  const target = nextUtc(6, 1);
  const fh = hourFor(cycle, target);
  // The ramp-up is measured against six hours earlier (about 7 p.m. Central).
  const base = hourFor(cycle, target - 6 * 3600_000);
  const W = [
    ":UGRD:850 mb:",
    ":VGRD:850 mb:",
    ":UGRD:925 mb:",
    ":VGRD:925 mb:",
  ];
  const [now, before, early, late] = await Promise.all([
    grab(cycle, fh, [
      ...W,
      ":UGRD:700 mb:",
      ":VGRD:700 mb:",
      ":DPT:850 mb:",
      ":HLCY:1000-0 m above ground:",
      ":CAPE:180-0 mb above ground:",
      ":PRES:surface:",
      ":LAND:surface:",
    ]),
    grab(cycle, base, W),
    grab(cycle, hourFor(cycle, target - 3 * 3600_000), W).catch(() => null),
    fhAt(cycle, target + 3 * 3600_000) <= 18
      ? grab(cycle, fhAt(cycle, target + 3 * 3600_000), W).catch(() => null)
      : null,
  ]);
  const [u8, v8, u9, v9, u7, v7, d8, srh, cape, ps, land] = now;
  const s8 = hypot(u8.values, v8.values);
  const s9 = hypot(u9.values, v9.values);
  const s7 = hypot(u7.values, v7.values);
  const b8 = hypot(before[0].values, before[1].values);
  const b9 = hypot(before[2].values, before[3].values);
  const n = s8.length;
  const out = new Float32Array(n);
  const cls = new Uint8Array(n);
  const mt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = ps.values[i] / 100;
    // A pressure level below the ground is the model's extrapolation, not wind.
    const use9 = p >= 950;
    // The nocturnal jet is a land phenomenon (the ground cooling at night); skip the sea.
    if (p < 880 || land.values[i] < 0.5) {
      out[i] = NaN;
      continue;
    }
    const jetMs = Math.max(s8[i], use9 ? s9[i] : 0);
    const jet = jetMs * KT;
    const was = Math.max(b8[i], use9 ? b9[i] : 0) * KT;
    // Bonner (1968): 12/16/20 m/s at the peak, falling 6/8/10 m/s by 3 km (700 mb).
    const fall = jetMs - s7[i];
    cls[i] =
      jetMs >= 20 && fall >= 10
        ? 3
        : jetMs >= 16 && fall >= 8
          ? 2
          : jetMs >= 12 && fall >= 6
            ? 1
            : 0;
    const e =
      6.112 *
      Math.exp((17.67 * (d8.values[i] - 273.15)) / (d8.values[i] - 29.65));
    mt[i] = ((622 * e) / Math.max(850 - e, 1)) * s8[i];
    const jt = clamp((jet - 25) / 25);
    const rt = clamp((jet - was) / 15);
    const st = clamp(srh.values[i] / 200);
    const ct = clamp(cape.values[i] / 1000);
    const bt = cls[i] ? 1 : 0.5;
    const qt = 0.6 + 0.4 * clamp((mt[i] - 60) / 140);
    out[i] =
      100 *
      jt *
      (0.4 + 0.6 * rt) *
      (0.5 + 0.5 * st) *
      (0.5 + 0.5 * ct) *
      bt *
      qt;
  }
  const cell = cellOf(u8.grid);
  const speedAt = (w: Field[] | null, i: number, use9: boolean) =>
    w
      ? Math.max(
          Math.hypot(w[0].values[i], w[1].values[i]),
          use9 ? Math.hypot(w[2].values[i], w[3].values[i]) : 0,
        ) * KT
      : -1;
  return {
    field: { grid: u8.grid, values: out },
    cycle,
    fh,
    detail: (lat, lon) => {
      const i = cell(lat, lon);
      if (i < 0) return undefined;
      const use9 = ps.values[i] / 100 >= 950;
      const opts = [
        [target - 3 * 3600_000, speedAt(early, i, use9)],
        [target, speedAt([u8, v8, u9, v9], i, use9)],
        [target + 3 * 3600_000, speedAt(late, i, use9)],
      ] as const;
      const [t, kt] = opts.reduce((a, b) => (b[1] > a[1] ? b : a));
      const at = new Date(t).toLocaleTimeString("en-US", {
        hour: "numeric",
        timeZone: "America/Chicago",
      });
      const kind = [
        "broad flow, no true jet",
        "a low-level jet",
        "a strong low-level jet",
        "an intense low-level jet",
      ][cls[i]];
      const wet =
        mt[i] >= 150
          ? " pumping in deep moisture"
          : mt[i] >= 90
            ? " carrying moisture"
            : "";
      return `Peaks near ${at} CT at ${Math.round(kt)} kt: ${kind}${wet}`;
    },
  };
}

/** Box-average a grid in place-free fashion (radius r cells), for smoothing a derivative. */
export function smooth(v: Float32Array, w: number, h: number, r: number) {
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = v[j * w + i];
      sum[(j + 1) * (w + 1) + i + 1] =
        (Number.isFinite(x) ? x : 0) +
        sum[j * (w + 1) + i + 1] +
        sum[(j + 1) * (w + 1) + i] -
        sum[j * (w + 1) + i];
    }
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const i0 = Math.max(0, i - r);
      const i1 = Math.min(w, i + r + 1);
      const j0 = Math.max(0, j - r);
      const j1 = Math.min(h, j + r + 1);
      const s =
        sum[j1 * (w + 1) + i1] -
        sum[j0 * (w + 1) + i1] -
        sum[j1 * (w + 1) + i0] +
        sum[j0 * (w + 1) + i0];
      out[j * w + i] = s / ((i1 - i0) * (j1 - j0));
    }
  return out;
}

/** SPC's Non-Supercell Tornado parameter: landspouts over land, waterspouts over water. */
async function nst(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, Date.now() + 3600_000);
  const [t2, t8, z8, zs, cape, cin, us, vs, u10, v10, land] = await grab(
    cycle,
    fh,
    [
      ":TMP:2 m above ground:",
      ":TMP:850 mb:",
      ":HGT:850 mb:",
      ":HGT:surface:",
      ":CAPE:0-3000 m above ground:",
      ":CIN:90-0 mb above ground:",
      ":VUCSH:0-6000 m above ground:",
      ":VVCSH:0-6000 m above ground:",
      ":UGRD:10 m above ground:",
      ":VGRD:10 m above ground:",
      ":LAND:surface:",
    ],
  );
  // Post-launch A6: water temperature (the model's surface temperature over water), the
  // convective cloud depth and the 850 mb wind for Szilagyi's Waterspout Index, and the 2 m
  // dew point to find the boundaries landspouts form on.
  const [tsf, el, lcl, u85, v85, d2] = await grab(cycle, fh, [
    ":TMP:surface:",
    ":HGT:equilibrium level:",
    ":HGT:level of adiabatic condensation from sfc:",
    ":UGRD:850 mb:",
    ":VGRD:850 mb:",
    ":DPT:2 m above ground:",
  ]);
  const g = t2.grid;
  const [w, h] = gridSize(g);
  const dx = g.kind === "lambert" ? g.dx : 3000;
  // Relative vorticity of the 10 m wind (grid-relative winds, so dv/dx − du/dy on the grid).
  const raw = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      raw[k] =
        (v10.values[k + 1] - v10.values[k - 1]) / (2 * dx) -
        (u10.values[k + w] - u10.values[k - w]) / (2 * dx);
    }
  const vort = smooth(raw, w, h, 4);
  // Boundaries: converging 10 m winds with a dew point edge across them (the same signals
  // Boundary Collisions reads), 0–1.
  const conv = new Float32Array(w * h);
  const edge = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      conv[k] = -(
        (u10.values[k + 1] - u10.values[k - 1]) / (2 * dx) +
        (v10.values[k + w] - v10.values[k - w]) / (2 * dx)
      );
      edge[k] =
        Math.hypot(
          d2.values[k + 1] - d2.values[k - 1],
          d2.values[k + w] - d2.values[k - w],
        ) /
        (2 * dx);
    }
  const convS = smooth(conv, w, h, 4);
  const edgeS = smooth(edge, w, h, 4);
  // Waterspouts count within ~60 km of land (bays, sounds, the Great Lakes, near shore).
  const coast = smooth(land.values, w, h, 20);
  const out = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) {
    if (land.values[k] < 0.5 && coast[k] <= 0) continue;
    if (land.values[k] < 0.5) {
      // Szilagyi Waterspout Index (simplified): warm water under cold air aloft (water − 850 mb
      // ≥ 8 °C, best near 20), deep enough convection (EL − LCL) and light 850 mb winds
      // (best under 15 kt, none past 25), mapped onto the NST scale (full = 4).
      const dT = tsf.values[k] - t8.values[k];
      const depth = el.values[k] - lcl.values[k];
      const wind = Math.hypot(u85.values[k], v85.values[k]) * KT;
      const wsi =
        clamp((dT - 8) / 12) *
        (Number.isFinite(depth) ? clamp((depth - 1500) / 4500) : 0) *
        clamp((25 - wind) / 10);
      out[k] = 4 * wsi;
    }
    const dz = (z8.values[k] - zs.values[k]) / 1000;
    if (!(dz > 0.3 && dz < 2)) continue;
    const lapse = (t2.values[k] - t8.values[k]) / dz;
    const shear = Math.hypot(us.values[k], vs.values[k]);
    const a = clamp(lapse / 9, 0, 1.5);
    const b = clamp(cape.values[k] / 100, 0, 3);
    const c = clamp((225 + cin.values[k]) / 200, 0, 1.2);
    const d = clamp((18 - shear) / 5, 0, 2);
    const e = clamp(vort[k] / 8e-5, 0, 3);
    const nst = a * b * c * d * e;
    // On land, boundaries raise the landspout value by up to 40%; away from them it drops 40%.
    const bnd = clamp(convS[k] / 4e-5) * clamp(edgeS[k] / 4e-5);
    out[k] = Math.max(
      out[k],
      land.values[k] < 0.5 ? nst : nst * (0.6 + 0.8 * bnd),
    );
  }
  return {
    field: { grid: g, values: out },
    cycle,
    fh,
    extra: { land: land.values },
  };
}

/** Hot-Dry-Windy Index at the afternoon peak, and each large fire's PyroCb chance. */
async function pyro(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, nextUtc(21));
  const [[t2, d2, u8, v8, t7, d7, t5, d5], fires] = await Promise.all([
    grab(cycle, fh, [
      ":TMP:2 m above ground:",
      ":DPT:2 m above ground:",
      ":UGRD:80 m above ground:",
      ":VGRD:80 m above ground:",
      ":TMP:700 mb:",
      ":DPT:700 mb:",
      ":TMP:500 mb:",
      ":DPT:500 mb:",
    ]),
    activeFires().catch(() => []),
  ]);
  const n = t2.values.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vpd = es(t2.values[i] - 273.15) - es(d2.values[i] - 273.15);
    out[i] = Math.max(0, vpd) * Math.hypot(u8.values[i], v8.values[i]);
  }
  const loc = locator(t2.grid);
  const [w] = gridSize(t2.grid);
  const at = (a: Float32Array, lat: number, lon: number) => {
    const [fi, fj] = loc(lat, lon);
    return a[Math.round(fj) * w + Math.round(fi)];
  };
  const list = fires
    .filter((f) => f.acres >= 100)
    .map((f) => {
      const hdwi = at(out, f.lat, f.lon);
      const inst = at(t7.values, f.lat, f.lon) - at(t5.values, f.lat, f.lon);
      const dd =
        (at(t7.values, f.lat, f.lon) -
          at(d7.values, f.lat, f.lon) +
          at(t5.values, f.lat, f.lon) -
          at(d5.values, f.lat, f.lon)) /
        2;
      const blow = clamp(hdwi / 150);
      const size = clamp(Math.log10(Math.max(f.acres, 1)) / 5);
      // A mostly contained fire has little open edge left to run.
      const open = clamp(1 - ((f.contained ?? 0) / 100) * 0.85);
      // PyroCb needs a hot, dry, windy surface, steep mid-level lapse rates (700–500 mb) and
      // some mid-level moisture for the plume to condense into.
      const chance =
        100 *
        blow *
        Math.sqrt(clamp((inst - 13) / 7)) *
        clamp((25 - dd) / 15) *
        (0.5 + 0.5 * size) *
        open;
      return {
        name: f.name,
        state: f.state,
        acres: f.acres,
        contained: f.contained,
        lat: f.lat,
        lon: f.lon,
        hdwi: Math.round(hdwi),
        lapse: Math.round(inst * 10) / 10,
        chance: Math.round(Number.isFinite(chance) ? chance : 0),
        blowup:
          hdwi >= 150
            ? "Extreme"
            : hdwi >= 100
              ? "High"
              : hdwi >= 50
                ? "Elevated"
                : "Low",
      };
    })
    .filter((f) => Number.isFinite(f.hdwi))
    .sort((a, b) => b.chance - a.chance || b.hdwi - a.hdwi)
    .slice(0, 40);
  return {
    field: { grid: t2.grid, values: out },
    cycle,
    fh,
    extra: { fires: list },
    rough: true,
  };
}

const R = 6371;
export const distKm = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const x =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const bearingDeg = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const y = Math.sin((d - b) * r) * Math.cos(c * r);
  const x =
    Math.cos(a * r) * Math.sin(c * r) -
    Math.sin(a * r) * Math.cos(c * r) * Math.cos((d - b) * r);
  return ((Math.atan2(y, x) / r + 360) % 360) as number;
};

/** Landfalling tropical cyclone tornado risk: 0–1 km helicity × 0–3 km CAPE near the storm. */
async function tctor(cycle: string): Promise<Computed> {
  const outlook = await getOutlook().catch(() => null);
  const storms = (outlook?.storms ?? []).filter(
    (s) =>
      s.kt >= 34 &&
      s.lat > 18 &&
      s.lat < 46 &&
      s.lon > -100 &&
      s.lon < -64 &&
      (s.basin === "AL" || s.basin === "EP"),
  );
  const fh = hourFor(cycle, Date.now() + 3 * 3600_000);
  const [srh, cape] = await grab(cycle, fh, [
    ":HLCY:1000-0 m above ground:",
    ":CAPE:0-3000 m above ground:",
  ]);
  const out = new Float32Array(srh.values.length);
  for (let i = 0; i < out.length; i++)
    out[i] =
      clamp(srh.values[i] / 100, 0, 6) * clamp(cape.values[i] / 40, 0, 4);
  // Tornadoes in landfalling storms come from the outer bands on the right of the track,
  // roughly 100–600 km from the center.
  const keep = (lat: number, lon: number) =>
    storms.some((s) => {
      const d = distKm(s.lat, s.lon, lat, lon);
      if (d < 80 || d > 650) return false;
      const head = s.dir ?? 0;
      const rel = (bearingDeg(s.lat, s.lon, lat, lon) - head + 360) % 360;
      return rel <= 180;
    });
  return {
    field: { grid: srh.grid, values: out },
    cycle,
    fh,
    keep,
    extra: {
      storms: storms.map((s) => ({
        name: s.title,
        lat: s.lat,
        lon: s.lon,
        mph: s.mph,
      })),
    },
    note: storms.length
      ? undefined
      : "No tropical storm or hurricane is near the U.S. coast right now.",
  };
}

const RD = 287.05;
/** Bulk 0–6 km shear (m/s) from its components. */
const bulk = (u: number, v: number) => Math.hypot(u, v);

/** The coming evening's valid times (21Z, 00Z, 03Z) that `cycle` reaches. */
function eveningTimes(cycle: string) {
  const t0 = cycleTime(cycle);
  const mid = nextUtc(0, 1);
  return [mid - 3 * 3600_000, mid, mid + 3 * 3600_000].filter((t) => {
    const h = (t - t0) / 3600_000;
    return h >= 0 && h <= 18;
  });
}
const fhAt = (cycle: string, t: number) =>
  Math.round((t - cycleTime(cycle)) / 3600_000);
/** `cycle` and the runs just before it that also reach `t` (a time-lagged ensemble). */
function laggedRuns(cycle: string, t: number, n: number) {
  const out = [cycle];
  const t0 = cycleTime(cycle);
  for (let k = 1; out.length < n && k <= 6; k++) {
    const c = ymdh(t0 - k * 3600_000);
    const h = fhAt(c, t);
    if (h >= 0 && h <= 18) out.push(c);
  }
  return out;
}
/** Native-grid index of the point nearest a lat/lon. */
function cellOf(grid: Field["grid"]) {
  const loc = locator(grid);
  const [w, h] = gridSize(grid);
  return (lat: number, lon: number) => {
    const [fi, fj] = loc(lat, lon);
    const x = Math.round(fi);
    const y = Math.round(fj);
    return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
  };
}
/** HRRR winds are relative to its Lambert grid; this turns one into east/north components. */
function earthWind(grid: Field["grid"], lon: number, ug: number, vg: number) {
  if (grid.kind !== "lambert") return [ug, vg] as const;
  const r = Math.PI / 180;
  const p1 = grid.latin1 * r;
  const p2 = grid.latin2 * r;
  const n =
    Math.abs(p1 - p2) < 1e-9
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) /
        Math.log(
          Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2),
        );
  const th = n * (((((lon - grid.lov + 180) % 360) + 360) % 360) - 180) * r;
  return [
    ug * Math.cos(th) + vg * Math.sin(th),
    -ug * Math.sin(th) + vg * Math.cos(th),
  ] as const;
}
const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];
const heading = (e: number, n: number) =>
  COMPASS[Math.round(((Math.atan2(e, n) * 180) / Math.PI + 360) / 22.5) % 16];

/**
 * Post-launch A6: the evening's highest value of a parameter over 21Z, 00Z and 03Z (with the
 * hour it peaks), and the chance it passes `threshold` at 00Z from the newest HRRR run and
 * the two before it.
 */
async function eveningOf(
  cycle: string,
  at: (c: string, fh: number) => Promise<Field>,
  threshold: number,
) {
  const times = eveningTimes(cycle);
  if (!times.length) throw new Error("This HRRR run doesn't reach the evening");
  const mid = times.includes(nextUtc(0, 1)) ? nextUtc(0, 1) : times[0];
  let grid: Field["grid"] | null = null;
  let max: Float32Array | null = null;
  let peak: Uint8Array | null = null;
  let atMid: Float32Array | null = null;
  for (let k = 0; k < times.length; k++) {
    const f = await at(cycle, fhAt(cycle, times[k]));
    grid ??= f.grid;
    max ??= new Float32Array(f.values.length).fill(-Infinity);
    peak ??= new Uint8Array(f.values.length);
    for (let i = 0; i < f.values.length; i++)
      if (f.values[i] > max[i]) {
        max[i] = f.values[i];
        peak[i] = k;
      }
    if (times[k] === mid) atMid = f.values;
  }
  const runs = laggedRuns(cycle, mid, 3);
  const hits = new Float32Array(max!.length);
  let used = 0;
  for (const c of runs) {
    const v =
      c === cycle && atMid
        ? atMid
        : await at(c, fhAt(c, mid))
            .then((f) => f.values)
            .catch(() => null);
    if (!v || v.length !== hits.length) continue;
    used++;
    for (let i = 0; i < v.length; i++) if (v[i] >= threshold) hits[i]++;
  }
  const prob = new Float32Array(hits.length);
  for (let i = 0; i < prob.length; i++)
    prob[i] = used ? (100 * hits[i]) / used : 0;
  const cell = cellOf(grid!);
  return {
    grid: grid!,
    max: max!,
    prob,
    used,
    mid,
    when: (lat: number, lon: number) => {
      const i = cell(lat, lon);
      return i < 0 ? undefined : times[peak![i]];
    },
  };
}

/**
 * SPC's effective-layer Significant Tornado Parameter (post-launch A6): mixed-layer CAPE, the
 * LCL, effective storm-relative helicity (the HRRR's own EFHL), bulk shear (0–6 km standing in
 * for the effective layer, which the HRRR doesn't carry) and mixed-layer CIN.
 */
async function stpAt(cycle: string, fh: number): Promise<Field> {
  const [cape, cin, lcl, zs, esrh, us, vs] = await grab(cycle, fh, [
    ":CAPE:90-0 mb above ground:",
    ":CIN:90-0 mb above ground:",
    ":HGT:level of adiabatic condensation from sfc:",
    ":HGT:surface:",
    ":EFHL:surface:",
    ":VUCSH:0-6000 m above ground:",
    ":VVCSH:0-6000 m above ground:",
  ]);
  const out = new Float32Array(cape.values.length);
  for (let i = 0; i < out.length; i++) {
    const lc = lcl.values[i] - zs.values[i];
    const lt = lc < 1000 ? 1 : lc > 2000 ? 0 : (2000 - lc) / 1000;
    const sh = bulk(us.values[i], vs.values[i]);
    const st = sh < 12.5 ? 0 : sh > 30 ? 1.5 : sh / 20;
    const ci = cin.values[i];
    const ct = ci > -50 ? 1 : ci < -200 ? 0 : (200 + ci) / 150;
    out[i] = Math.max(
      0,
      (cape.values[i] / 1500) * lt * (esrh.values[i] / 150) * st * ct,
    );
  }
  return { grid: cape.grid, values: out };
}

/** Significant Tornado: the evening peak of effective-layer STP and the chance of STP ≥ 1. */
async function stp(cycle: string): Promise<Computed> {
  const e = await eveningOf(cycle, stpAt, 1);
  return {
    field: { grid: e.grid, values: e.max },
    cycle,
    fh: fhAt(cycle, e.mid),
    when: e.when,
    alt: { field: { grid: e.grid, values: e.prob }, levels: PROB_BANDS.levels },
    altDetail: () => `Chance from the last ${e.used} HRRR runs`,
    altWhen: () => e.mid,
  };
}

/**
 * Effective-layer Supercell Composite (Thompson and others): most-unstable CAPE × effective
 * helicity × bulk shear, with the CIN term; right movers only. `keep` holds the peak hour's
 * fields for the storm-mode hint.
 */
const scpKeep = new Map<string, { cape: Field; us: Field; vs: Field }>();
async function scpAt(cycle: string, fh: number): Promise<Field> {
  const [mu, mucin, esrh, us, vs] = await grab(cycle, fh, [
    ":CAPE:255-0 mb above ground:",
    ":CIN:255-0 mb above ground:",
    ":EFHL:surface:",
    ":VUCSH:0-6000 m above ground:",
    ":VVCSH:0-6000 m above ground:",
  ]);
  const out = new Float32Array(mu.values.length);
  for (let i = 0; i < out.length; i++) {
    const sh = bulk(us.values[i], vs.values[i]);
    const st = sh < 10 ? 0 : sh > 20 ? 1 : sh / 20;
    const c = mucin.values[i];
    const ct = c > -40 ? 1 : -40 / c;
    out[i] = Math.max(
      0,
      (mu.values[i] / 1000) * (esrh.values[i] / 50) * st * ct,
    );
  }
  scpKeep.set(`${cycle}:${fh}`, { cape: mu, us, vs });
  return { grid: mu.grid, values: out };
}

/**
 * Storm-mode hint (post-launch A6): deep shear crossing the edge of the instability (the
 * boundary storms start on) favors discrete supercells; shear running along it lines them up.
 */
function modeHint(k: { cape: Field; us: Field; vs: Field }) {
  const cell = cellOf(k.cape.grid);
  const val = (lat: number, lon: number) => {
    const i = cell(lat, lon);
    return i < 0 ? NaN : k.cape.values[i];
  };
  return (lat: number, lon: number) => {
    const d = 0.35;
    const ge =
      (val(lat, lon + d) - val(lat, lon - d)) /
      (2 * d * Math.cos((lat * Math.PI) / 180));
    const gn = (val(lat + d, lon) - val(lat - d, lon)) / (2 * d);
    const gm = Math.hypot(ge, gn);
    const i = cell(lat, lon);
    if (i < 0 || !Number.isFinite(gm) || gm < 150) return undefined;
    const [se, sn] = earthWind(
      k.cape.grid,
      lon,
      k.us.values[i],
      k.vs.values[i],
    );
    const sm = Math.hypot(se, sn);
    if (sm < 10) return undefined;
    // Share of the shear pointing across the boundary (along the instability gradient).
    const across = Math.abs((se * ge + sn * gn) / (gm * sm));
    return across > 0.7
      ? "Discrete supercells favored: the shear crosses the instability edge"
      : across < 0.4
        ? "Storms may line up: the shear runs along the instability edge"
        : "Mixed storm modes likely";
  };
}

/** Supercell Composite: evening peak of the effective-layer SCP, chance of SCP ≥ 1, mode hint. */
async function scp(cycle: string): Promise<Computed> {
  scpKeep.clear();
  const e = await eveningOf(cycle, scpAt, 1);
  const k = scpKeep.get(`${cycle}:${fhAt(cycle, e.mid)}`);
  scpKeep.clear();
  return {
    field: { grid: e.grid, values: e.max },
    cycle,
    fh: fhAt(cycle, e.mid),
    when: e.when,
    detail: k ? modeHint(k) : undefined,
    alt: { field: { grid: e.grid, values: e.prob }, levels: PROB_BANDS.levels },
    altDetail: () => `Chance from the last ${e.used} HRRR runs`,
    altWhen: () => e.mid,
  };
}

/**
 * Moist-adiabat table: a saturated parcel's temperature (K) by its wet-bulb potential
 * temperature (250–315 K, every 0.5 K) and pressure (300–1100 hPa, every 10 hPa), built once.
 */
const MOIST = (() => {
  const t: number[][] = [];
  for (let w = 250; w <= 315; w += 0.5) {
    const te = thetaE(w, w, 100000);
    const row: number[] = [];
    for (let p = 300; p <= 1100; p += 10) {
      let lo = 150;
      let hi = 340;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (thetaE(m, m, p * 100) < te) lo = m;
        else hi = m;
      }
      row.push((lo + hi) / 2);
    }
    t.push(row);
  }
  return t;
})();
function moistT(thw: number, hpa: number) {
  const x = clamp((thw - 250) / 0.5, 0, MOIST.length - 1.001);
  const y = clamp((hpa - 300) / 10, 0, MOIST[0].length - 1.001);
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const a = MOIST[i][j] * (1 - fy) + MOIST[i][j + 1] * fy;
  const b = MOIST[i + 1][j] * (1 - fy) + MOIST[i + 1][j + 1] * fy;
  return a * (1 - fx) + b * fx;
}

/**
 * Evans and Doswell's Derecho Composite Parameter at this evening's peak. DCAPE, which the
 * HRRR doesn't carry, is a parcel let down from the drier of 700 and 500 mb at its wet-bulb
 * temperature, moist-adiabatically, to the ground; the energy is its coldness against the
 * environment on the way down.
 */
async function dcp(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, nextUtc(0, 1));
  const [[u3, v3], swath, complex] = await Promise.all([
    grab(cycle, fh, [":UGRD:300 mb:", ":VGRD:300 mb:"]),
    windSwath(cycle, fh),
    complexes(cycle, fh),
  ]);
  const [
    mu,
    us,
    vs,
    u0,
    v0,
    u8,
    v8,
    u7,
    v7,
    u5,
    v5,
    t2,
    t8,
    t7,
    d7,
    t5,
    d5,
    ps,
  ] = await grab(cycle, fh, [
    ":CAPE:255-0 mb above ground:",
    ":VUCSH:0-6000 m above ground:",
    ":VVCSH:0-6000 m above ground:",
    ":UGRD:10 m above ground:",
    ":VGRD:10 m above ground:",
    ":UGRD:850 mb:",
    ":VGRD:850 mb:",
    ":UGRD:700 mb:",
    ":VGRD:700 mb:",
    ":UGRD:500 mb:",
    ":VGRD:500 mb:",
    ":TMP:2 m above ground:",
    ":TMP:850 mb:",
    ":TMP:700 mb:",
    ":DPT:700 mb:",
    ":TMP:500 mb:",
    ":DPT:500 mb:",
    ":PRES:surface:",
  ]);
  const out = new Float32Array(mu.values.length);
  for (let i = 0; i < out.length; i++) {
    const p0 = ps.values[i] / 100;
    if (p0 < 750 || mu.values[i] < 100) {
      out[i] = p0 < 750 ? NaN : 0;
      continue;
    }
    const has8 = p0 > 875;
    // 0–6 km mean wind from the levels in between, in knots.
    const uu = [u0.values[i], u7.values[i], u5.values[i]];
    const vv = [v0.values[i], v7.values[i], v5.values[i]];
    if (has8) {
      uu.push(u8.values[i]);
      vv.push(v8.values[i]);
    }
    const mean =
      Math.hypot(
        uu.reduce((a, b) => a + b, 0) / uu.length,
        vv.reduce((a, b) => a + b, 0) / vv.length,
      ) * KT;
    const te7 = thetaE(t7.values[i], d7.values[i], 70000);
    const te5 = thetaE(t5.values[i], d5.values[i], 50000);
    const start = te5 < te7 ? 500 : 700;
    const thw = thetaW(Math.min(te5, te7));
    const lv: [number, number][] = [
      ...(start === 500 ? ([[500, t5.values[i]]] as [number, number][]) : []),
      [700, t7.values[i]],
      ...(has8 ? ([[850, t8.values[i]]] as [number, number][]) : []),
      [p0, t2.values[i]],
    ];
    let dcape = 0;
    for (let k = 0; k < lv.length - 1; k++) {
      const [pa, ea] = lv[k];
      const [pb, eb] = lv[k + 1];
      const da = ea - moistT(thw, pa);
      const db = eb - moistT(thw, pb);
      dcape += RD * ((da + db) / 2) * Math.log(pb / pa);
    }
    const sh = bulk(us.values[i], vs.values[i]) * KT;
    out[i] = Math.max(
      0,
      (Math.max(0, dcape) / 980) *
        (mu.values[i] / 2000) *
        (sh / 20) *
        (mean / 16),
    );
  }
  // Post-launch A6: DCP was built for places a storm complex already exists, so it counts in
  // full only within ~200 km of an organized line in the HRRR (a third elsewhere), and the
  // HRRR's own modeled gusts weigh it (half at 25 kt or less, full at 50 kt and up).
  const lat = toLattice({ grid: mu.grid, values: out }, 1);
  for (let i = 0; i < lat.length; i++) {
    if (!Number.isFinite(lat[i])) continue;
    const w = clamp((swath[i] * KT - 25) / 25);
    lat[i] *= (complex[i] ? 1 : 0.35) * (0.5 + 0.5 * w);
  }
  const cell = cellOf(mu.grid);
  return {
    field: { grid: LATTICE, values: lat },
    cycle,
    fh,
    detail: (la, lo) => {
      const i = cell(la, lo);
      if (i < 0) return undefined;
      // Corfidi vectors: the cloud-layer mean wind (850–300 mb) and the low-level jet (850).
      const e = (ug: number, vg: number) => earthWind(mu.grid, lo, ug, vg);
      const lv = [
        e(u8.values[i], v8.values[i]),
        e(u7.values[i], v7.values[i]),
        e(u5.values[i], v5.values[i]),
        e(u3.values[i], v3.values[i]),
      ];
      const ce = lv.reduce((a, w) => a + w[0], 0) / lv.length;
      const cn = lv.reduce((a, w) => a + w[1], 0) / lv.length;
      const de = 2 * ce - lv[0][0];
      const dn = 2 * cn - lv[0][1];
      const mph = Math.round(Math.hypot(de, dn) * 2.23694);
      const g = swath[latticeCell(la, lo)];
      return `A complex would race ${heading(de, dn)} near ${mph} mph${Number.isFinite(g) && g * KT >= 40 ? ` · HRRR gusts to ${Math.round(g * 2.23694)} mph` : ""}`;
    },
  };
}

/** Coarse 0.5° grid the 0–3 km shear is kept on for ProbTor's squall-line check. */
const SH = 0.5;
const SW = Math.round((CONUS[2] - CONUS[0]) / SH) + 1;
const SHH = Math.round((CONUS[3] - CONUS[1]) / SH) + 1;
type ShearGrid = { cycle: string; fh: number; u: number[]; v: number[] };
let shearMemo: ShearGrid | null = null;

/**
 * The HRRR's 0–3 km shear (kt, earth-relative east and north) for the current hour: the wind
 * about 3 km above the ground (interpolated in log-pressure between 850, 700 and 500 mb at 69%
 * of the surface pressure) minus the 10 m wind. Worked out once per HRRR run on a 0.5° grid and
 * kept in private Storage, so only the first ProbTor request of the hour pays for it.
 */
export async function shear03(): Promise<
  (lat: number, lon: number) => [number, number] | null
> {
  const cycle = await latestCycle("hrrr");
  if (!cycle) throw new Error("No HRRR run is available");
  if (shearMemo?.cycle !== cycle) {
    const kept = await readJson<ShearGrid | null>("tor/shear03.json", null);
    if (kept?.cycle === cycle) shearMemo = kept;
  }
  if (shearMemo?.cycle !== cycle) {
    const fh = hourFor(cycle, Date.now());
    const [u10, v10, u85, v85, u70, v70, u50, v50, ps] = await grab(cycle, fh, [
      ":UGRD:10 m above ground:",
      ":VGRD:10 m above ground:",
      ":UGRD:850 mb:",
      ":VGRD:850 mb:",
      ":UGRD:700 mb:",
      ":VGRD:700 mb:",
      ":UGRD:500 mb:",
      ":VGRD:500 mb:",
      ":PRES:surface:",
    ]);
    const at = cellOf(u10.grid);
    const u: number[] = [];
    const v: number[] = [];
    for (let j = 0; j < SHH; j++)
      for (let i = 0; i < SW; i++) {
        const lat = CONUS[3] - j * SH;
        const lon = CONUS[0] + i * SH;
        const k = at(lat, lon);
        if (k < 0 || !Number.isFinite(ps.values[k])) {
          u.push(0);
          v.push(0);
          continue;
        }
        const p3 = Math.log(0.69 * ps.values[k]);
        const [lo, hi] =
          p3 >= Math.log(70000)
            ? ([
                [85000, u85, v85],
                [70000, u70, v70],
              ] as const)
            : ([
                [70000, u70, v70],
                [50000, u50, v50],
              ] as const);
        const f = clamp((Math.log(lo[0]) - p3) / Math.log(lo[0] / hi[0]));
        const ug =
          lo[1].values[k] +
          f * (hi[1].values[k] - lo[1].values[k]) -
          u10.values[k];
        const vg =
          lo[2].values[k] +
          f * (hi[2].values[k] - lo[2].values[k]) -
          v10.values[k];
        const [e, n] = earthWind(u10.grid, lon, ug, vg);
        u.push(Math.round(e * KT));
        v.push(Math.round(n * KT));
      }
    shearMemo = { cycle, fh, u, v };
    await writeJson("tor/shear03.json", shearMemo).catch(() => undefined);
  }
  const g = shearMemo;
  return (lat, lon) => {
    const i = Math.round((lon - CONUS[0]) / SH);
    const j = Math.round((CONUS[3] - lat) / SH);
    if (i < 0 || j < 0 || i >= SW || j >= SHH) return null;
    return [g.u[j * SW + i], g.v[j * SW + i]];
  };
}

/** The 0.1° lattice cell of a lat/lon. */
function latticeCell(lat: number, lon: number) {
  const i = Math.round((lon - CONUS[0]) / 0.1);
  const j = Math.round((CONUS[3] - lat) / 0.1);
  return i < 0 || j < 0 || i >= LW || j >= LH ? -1 : j * LW + i;
}

/** The HRRR's hourly maximum 10 m wind (m/s), the most over two hours either side of `fh`. */
async function windSwath(cycle: string, fh: number) {
  const hrs = [fh - 2, fh - 1, fh, fh + 1, fh + 2].filter(
    (h) => h >= 1 && h <= 18,
  );
  const out = new Float32Array(LW * LH);
  const fields = await Promise.all(
    hrs.map((h) =>
      grab(cycle, h, [":WIND:10 m above ground:"])
        .then(([f]) => toLattice(f, 1))
        .catch(() => null),
    ),
  );
  for (const f of fields)
    if (f)
      for (let i = 0; i < out.length; i++) if (f[i] > out[i]) out[i] = f[i];
  return out;
}

/**
 * Where an organized storm complex is in the HRRR (40 dBZ areas at least 100 km across over
 * the three hours before `fh`), spread ~200 km: the places DCP's environment can act on.
 */
async function complexes(cycle: string, fh: number) {
  const hrs = [fh - 3, fh - 2, fh - 1, fh].filter((h) => h >= 1 && h <= 18);
  const mask = new Uint8Array(LW * LH);
  const fields = await Promise.all(
    hrs.map((h) =>
      grab(cycle, h, [":REFC:entire atmosphere:"])
        .then(([f]) => toLattice(f, 1))
        .catch(() => null),
    ),
  );
  const seen = new Uint8Array(LW * LH);
  for (const f of fields) {
    if (!f) continue;
    seen.fill(0);
    for (let s0 = 0; s0 < f.length; s0++) {
      if (seen[s0] || !(f[s0] >= 40)) continue;
      // Flood-fill one 40 dBZ area and measure how far it reaches.
      const stack = [s0];
      const cells: number[] = [];
      seen[s0] = 1;
      let i0 = LW,
        i1 = 0,
        j0 = LH,
        j1 = 0;
      while (stack.length) {
        const c = stack.pop()!;
        cells.push(c);
        const ci = c % LW;
        const cj = (c / LW) | 0;
        if (ci < i0) i0 = ci;
        if (ci > i1) i1 = ci;
        if (cj < j0) j0 = cj;
        if (cj > j1) j1 = cj;
        for (const n of [c - 1, c + 1, c - LW, c + LW]) {
          if (n < 0 || n >= f.length || seen[n] || !(f[n] >= 40)) continue;
          if (Math.abs((n % LW) - ci) > 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      const km = Math.hypot((i1 - i0) * 9, (j1 - j0) * 11);
      if (km >= 100) for (const c of cells) mask[c] = 1;
    }
  }
  const spreadMask = spread(Float32Array.from(mask), 18);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = spreadMask[i] > 0 ? 1 : 0;
  return out;
}

/**
 * Lightning Threat: the HRRR's own lightning forecast (flashes per km² per 5 minutes), the most
 * over the next three hours. Post-launch A6: the first hour uses the lightning happening now
 * (NOAA nowCOAST strike density, last 30 minutes) carried 40 minutes along the HRRR's 700 mb
 * wind, and hours two and three are corrected by each region's running ratio of observed to
 * modeled lightning (kept in private storage).
 */
async function ltg(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, Date.now() + 3600_000);
  const now = hourFor(cycle, Date.now());
  const hours = [fh, fh + 1, fh + 2].filter((h) => h <= 18);
  const [runs, [u7, v7], [atNow], strikes, factors] = await Promise.all([
    Promise.all(hours.map((h) => grab(cycle, h, [":LTNG:entire atmosphere:"]))),
    grab(cycle, fh, [":UGRD:700 mb:", ":VGRD:700 mb:"]),
    grab(cycle, now, [":LTNG:entire atmosphere:"]),
    nationalStrikes(CONUS as [number, number, number, number], LW, LH).catch(
      () => null,
    ),
    readJson<Record<string, number>>("calib/ltg.json", {}).catch(
      () => ({}) as Record<string, number>,
    ),
  ]);
  const region = (k: number) => {
    const lon = CONUS[0] + (k % LW) * 0.1;
    const lat = CONUS[3] - Math.floor(k / LW) * 0.1;
    return `${lon < -105 ? "w" : lon < -90 ? "c" : "e"}${lat < 37 ? "s" : "n"}`;
  };
  const out = new Float32Array(LW * LH);
  runs.forEach(([r], h) => {
    const lat = toLattice(r, 1);
    for (let k = 0; k < out.length; k++) {
      const f = h === 0 ? 1 : (factors[region(k)] ?? 1);
      const v = lat[k] * f;
      if (v > out[k]) out[k] = v;
    }
  });
  if (strikes) {
    // Strike density (strikes/km²/min × 1000) to total flashes per km² per 5 minutes: ground
    // networks see roughly a third of all flashes.
    const cell = cellOf(u7.grid);
    for (let k = 0; k < strikes.length; k++) {
      const c = strikes[k];
      if (c < 0) continue;
      const v = (LT_CLASSES[c].v * 3 * 5) / 1000;
      const lon = CONUS[0] + (k % LW) * 0.1;
      const lat = CONUS[3] - Math.floor(k / LW) * 0.1;
      const g = cell(lat, lon);
      let la = lat;
      let lo = lon;
      if (g >= 0) {
        const [ue, vn] = earthWind(u7.grid, lon, u7.values[g], v7.values[g]);
        la += (vn * 2400) / 111_320;
        lo += (ue * 2400) / (111_320 * Math.cos((lat * Math.PI) / 180));
      }
      for (const [dl, dn] of [
        [0, 0],
        [lat - la, lon - lo],
      ] as const) {
        const t = latticeCell(la + dl * 0.5, lo + dn * 0.5);
        if (t >= 0 && v > out[t]) out[t] = v;
      }
    }
    // Learn each region's observed-to-modeled ratio for the later hours (slowly).
    const obs: Record<string, number> = {};
    const mod: Record<string, number> = {};
    const nowLat = toLattice(atNow, 1);
    for (let k = 0; k < strikes.length; k++) {
      const r = region(k);
      if (strikes[k] >= 0) obs[r] = (obs[r] ?? 0) + 1;
      if (nowLat[k] >= 0.05) mod[r] = (mod[r] ?? 0) + 1;
    }
    const next: Record<string, number> = { ...factors };
    for (const r of ["ws", "wn", "cs", "cn", "es", "en"]) {
      const ratio = ((obs[r] ?? 0) + 20) / ((mod[r] ?? 0) + 20);
      next[r] = clamp(
        (factors[r] ?? 1) * 0.85 + clamp(ratio, 0.5, 2) * 0.15,
        0.5,
        2,
      );
    }
    await writeJson("calib/ltg.json", next).catch(() => undefined);
  }
  return {
    field: { grid: LATTICE, values: out },
    cycle,
    fh,
    note: strikes
      ? undefined
      : "Live lightning couldn't be read, so the first hour is the model's alone.",
  };
}

/**
 * Rain-Wrap Index (0–100) where this evening's supercells could form (SCP ≥ 1): how hidden a
 * tornado may be in rain. After Rasmussen and Straka (1998), weak storm-relative wind at anvil
 * level (250–300 mb) keeps the rain falling around the updraft (heavy-precipitation storms);
 * strong anvil-level flow carries it away (low-precipitation storms). Deep moisture and a low
 * cloud base add to it. Storm motion is the HRRR's own Bunkers right mover.
 */
async function rwrap(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, nextUtc(0, 1));
  // The heights of 300, 250 and 200 mb and the 200 mb wind are only in the pressure-level
  // file; with them the storm-relative wind is read 9–11 km above the ground (Thompson).
  const prs = MODELS.hrrr
    .url(cycle.slice(0, 8), cycle.slice(8), fh)
    .replace("wrfsfcf", "wrfprsf");
  const [[z30, z25, z20, u20, v20], sfc] = await Promise.all([
    Promise.all(
      [
        ":HGT:300 mb:",
        ":HGT:250 mb:",
        ":HGT:200 mb:",
        ":UGRD:200 mb:",
        ":VGRD:200 mb:",
      ].map((m) => record(prs, m)),
    ).catch(() => [null, null, null, null, null] as const),
    grab(cycle, fh, [
      ":CAPE:255-0 mb above ground:",
      ":CIN:255-0 mb above ground:",
      ":HLCY:3000-0 m above ground:",
      ":VUCSH:0-6000 m above ground:",
      ":VVCSH:0-6000 m above ground:",
      ":USTM:0-6000 m above ground:",
      ":VSTM:0-6000 m above ground:",
      ":UGRD:250 mb:",
      ":VGRD:250 mb:",
      ":UGRD:300 mb:",
      ":VGRD:300 mb:",
      ":PWAT:entire atmosphere",
      ":HGT:level of adiabatic condensation from sfc:",
      ":HGT:surface:",
    ]),
  ]);
  const [mu, mucin, srh, us, vs, ust, vst, u25, v25, u30, v30, pw, lcl, zs] =
    sfc;
  const deep = z30 && z25 && z20 && u20 && v20;
  const out = new Float32Array(mu.values.length);
  for (let i = 0; i < out.length; i++) {
    const sh = bulk(us.values[i], vs.values[i]);
    const c = mucin.values[i];
    const scp =
      (mu.values[i] / 1000) *
      (srh.values[i] / 50) *
      (sh < 10 ? 0 : sh > 20 ? 1 : sh / 20) *
      (c > -40 ? 1 : -40 / c);
    if (!(scp >= 1)) continue;
    let sr = Math.hypot(
      (u25.values[i] + u30.values[i]) / 2 - ust.values[i],
      (v25.values[i] + v30.values[i]) / 2 - vst.values[i],
    );
    if (deep) {
      // Mean storm-relative wind at 9, 10 and 11 km above ground, linear in height between
      // 300, 250 and 200 mb (held at the end levels outside them).
      const lv = [
        [z30.values[i], u30.values[i], v30.values[i]],
        [z25.values[i], u25.values[i], v25.values[i]],
        [z20.values[i], u20.values[i], v20.values[i]],
      ];
      let sum = 0;
      for (const agl of [9000, 10000, 11000]) {
        const z = zs.values[i] + agl;
        let k = 0;
        while (k < 1 && z > lv[k + 1][0]) k++;
        const f = clamp((z - lv[k][0]) / (lv[k + 1][0] - lv[k][0]));
        sum += Math.hypot(
          lv[k][1] + f * (lv[k + 1][1] - lv[k][1]) - ust.values[i],
          lv[k][2] + f * (lv[k + 1][2] - lv[k][2]) - vst.values[i],
        );
      }
      sr = sum / 3;
    }
    const wind = clamp((28 - sr) / 10);
    const wet = clamp((pw.values[i] - 20) / 20);
    const base = clamp((1500 - (lcl.values[i] - zs.values[i])) / 1000);
    out[i] = Math.max(1, 100 * (0.6 * wind + 0.3 * wet + 0.1 * base));
  }
  return {
    field: { grid: mu.grid, values: out },
    cycle,
    fh,
    note: deep
      ? undefined
      : "The HRRR's upper levels weren't readable, so anvil-level wind is the 250–300 mb mean.",
  };
}

/** NOHRSC snow depth classes as the map service colors them, with each class's lower bound (in). */
const NSA: [number, number, number, number][] = [
  [171, 193, 191, 0.39],
  [102, 193, 196, 2],
  [99, 169, 203, 3.9],
  [80, 121, 200, 9.8],
  [60, 63, 194, 20],
  [87, 32, 195, 39],
  [125, 1, 187, 59],
  [180, 4, 177, 98],
  [169, 19, 119, 197],
  [153, 43, 80, 295],
  [139, 69, 69, 394],
];

/**
 * NOAA NOHRSC's observed snow depth (its daily National Snow Analysis, which assimilates
 * station, airborne and satellite snow reports) on the 0.1° lattice, in meters: each cell the
 * deepest class lower bound in its four 0.05° pixels. Transparent is under 0.39".
 */
export async function nohrscDepth() {
  const q = new URLSearchParams({
    bbox: CONUS.join(","),
    bboxSR: "4326",
    imageSR: "4326",
    // The service only draws the raster at 0.083° a pixel or finer.
    size: `${LW * 2},${LH * 2}`,
    layers: "show:0",
    format: "png32",
    transparent: "true",
    f: "image",
  });
  const r = await fetch(
    `https://mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer/export?${q}`,
    { signal: AbortSignal.timeout(25000), next: { revalidate: 3600 } },
  );
  if (!r.ok || !r.headers.get("content-type")?.includes("png"))
    throw new Error(`NOHRSC ${r.status}`);
  const { rgba } = decodePng(Buffer.from(await r.arrayBuffer()));
  const out = new Float32Array(LW * LH);
  const W2 = LW * 2;
  for (let j = 0; j < LH * 2; j++)
    for (let i = 0; i < W2; i++) {
      const k = (j * W2 + i) * 4;
      if (rgba[k + 3] < 128) continue;
      const c = NSA.find(
        ([R, G, B]) =>
          Math.abs(rgba[k] - R) +
            Math.abs(rgba[k + 1] - G) +
            Math.abs(rgba[k + 2] - B) <
          12,
      );
      if (!c) continue;
      const q2 = (j >> 1) * LW + (i >> 1);
      out[q2] = Math.max(out[q2], c[3] * 0.0254);
    }
  return out;
}

/**
 * Li and Pomeroy's (1997) 10 m wind at which dry snow starts to blow, by air temperature (°C):
 * about 8.6 m/s at −5 °C, lowest (7 m/s) near −27 °C.
 */
export const blowThreshold = (c: number) => 9.43 + 0.18 * c + 0.0033 * c * c;

/**
 * Blizzard Composite: hours of whiteout over the next two days, by the Weather Service's
 * blizzard test (gusts of 35 mph or more with snow cutting visibility to a quarter mile).
 * The newest run gives every 2 hours to 18; the newest 48-hour run every 3 hours after
 * that. Falling snow counts where the HRRR snows with visibility under half a mile; blowing
 * snow where at least 2" of snow lies, it is −5 °C or colder (dry, loose snow) and gusts reach
 * 40 mph. Time runs out at 35 seconds; the note then says how far it counted.
 */
async function blizz(cycle: string): Promise<Computed> {
  const start = Date.now();
  const t0 = cycleTime(cycle);
  const long = await longRun(cycle);
  const steps: { c: string; fh: number; at: number; dur: number }[] = [];
  for (let fh = 1; fh <= 17; fh += 2)
    steps.push({ c: cycle, fh, at: fh, dur: 2 });
  if (long) {
    const off = (t0 - cycleTime(long)) / 3600_000;
    for (let at = 20; at + off <= 48; at += 3)
      steps.push({ c: long, fh: at + off, at, dur: 3 });
  }
  const [[snodNear], obs, past] = await Promise.all([
    grab(cycle, 1, [":SNOD:surface:"]),
    nohrscDepth().catch(() => null),
    // The last day of HRRR analyses, for how old and how crusted the snow on the ground is.
    Promise.all(
      [24, 18, 12, 6].map((h) =>
        grab(ymdh(t0 - h * 3600_000), 0, [
          ":TMP:2 m above ground:",
          ":CSNOW:surface:",
        ]).catch(() => null),
      ),
    ),
  ]);
  const n = snodNear.values.length;
  const hours = new Float32Array(n);
  const first = new Float32Array(n).fill(NaN);
  const last = new Float32Array(n);
  const model0 = snodNear.values;
  // Snow on the ground starts from NOHRSC's observed depth where it has one; the model adds
  // what it snows after that.
  const ground = new Float32Array(model0);
  if (obs) {
    const loc = locator(snodNear.grid);
    const [w, h] = gridSize(snodNear.grid);
    ground.fill(NaN);
    for (let j = 0; j < LH; j++)
      for (let i = 0; i < LW; i++) {
        const [fi, fj] = loc(CONUS[3] - j * 0.1, CONUS[0] + i * 0.1);
        const x = Math.round(fi);
        const y = Math.round(fj);
        for (let b = Math.max(0, y - 2); b <= Math.min(h - 1, y + 2); b++)
          for (let a = Math.max(0, x - 2); a <= Math.min(w - 1, x + 2); a++) {
            const k = b * w + a;
            ground[k] = Math.max(
              Number.isFinite(ground[k]) ? ground[k] : 0,
              obs[j * LW + i],
            );
          }
      }
    for (let i = 0; i < n; i++)
      if (!Number.isFinite(ground[i])) ground[i] = model0[i];
  }
  // Snow state (Li and Pomeroy): 0 aged dry, 1 fresh (snowed in the last day), 2 crusted
  // (above +0.5 °C since it last snowed: thawed and refrozen, it doesn't drift).
  const state = new Uint8Array(n);
  for (const f of past) {
    if (!f) continue;
    const [t2, cs] = f;
    for (let i = 0; i < n; i++) {
      if (t2.values[i] > 273.65) state[i] = 2;
      if (cs.values[i] >= 0.5) state[i] = 1;
    }
  }
  let snod = model0;
  let through = 0;
  // On Vercel a request has 60 seconds; on GitHub Actions (post-launch cost guard) it runs whole.
  const LIMIT = process.env.VERCEL ? 35_000 : 600_000;
  for (let k = 0; k < steps.length; k += 3) {
    if (Date.now() - start > LIMIT) break;
    const batch = steps.slice(k, k + 3);
    const got = await Promise.all(
      batch.map((st) =>
        grab(st.c, st.fh, [
          ":GUST:surface:",
          ":VIS:surface:",
          ":CSNOW:surface:",
          ":TMP:2 m above ground:",
          ":UGRD:10 m above ground:",
          ":VGRD:10 m above ground:",
          ...(st.c === long && st.at === 20 ? [":SNOD:surface:"] : []),
        ]),
      ),
    );
    batch.forEach((st, b) => {
      const [g, v, cs, t2, u10, v10, sd] = got[b];
      if (sd) snod = sd.values;
      for (let i = 0; i < n; i++) {
        if (cs.values[i] >= 0.5) state[i] = 1;
        else if (t2.values[i] > 273.65) state[i] = 2;
        const mph = g.values[i] * 2.237;
        if (mph < 35) continue;
        const falling = cs.values[i] >= 0.5 && v.values[i] <= 800;
        // Blowing snow cuts visibility to a quarter mile at about 1.5 times the wind that
        // starts it moving; aged snow needs 2 m/s more, crusted snow doesn't blow.
        const depth = ground[i] + Math.max(0, snod[i] - model0[i]);
        const wind = Math.hypot(u10.values[i], v10.values[i]);
        const ut =
          blowThreshold(t2.values[i] - 273.15) + (state[i] === 0 ? 2 : 0);
        const blowing =
          depth >= 0.05 &&
          state[i] !== 2 &&
          t2.values[i] <= 273.15 &&
          wind >= 1.5 * ut;
        if (!falling && !blowing) continue;
        hours[i] += st.dur;
        if (!(first[i] <= st.at)) first[i] = st.at - st.dur / 2;
        last[i] = st.at + st.dur / 2;
      }
      through = st.at + st.dur / 2;
    });
  }
  const loc = locator(snodNear.grid);
  const [w] = gridSize(snodNear.grid);
  const cell = (lat: number, lon: number) => {
    const [fi, fj] = loc(lat, lon);
    return Math.round(fj) * w + Math.round(fi);
  };
  return {
    field: { grid: snodNear.grid, values: hours },
    cycle,
    fh: 1,
    note:
      [
        through < 47
          ? `Counted through the next ${Math.round(through)} hours.`
          : "",
        obs
          ? ""
          : "NOHRSC's snow analysis wasn't readable, so snow on the ground is the model's.",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    flags: (spots) =>
      spots
        .filter((x) => x.value >= 3)
        .flatMap((x) => {
          const i = cell(x.lat, x.lon);
          if (!Number.isFinite(first[i])) return [];
          const at = t0 + first[i] * 3600_000;
          return [
            {
              key: `${new Date(at).toISOString().slice(0, 10)}:${x.lat.toFixed(1)},${x.lon.toFixed(1)}`,
              at,
              lat: x.lat,
              lon: x.lon,
              label: `${x.place} (${x.value} h)`,
              window_min: Math.min(
                720,
                Math.round((last[i] - first[i] + 3) * 60),
              ),
              radius_km: 40,
            },
          ];
        }),
  };
}

export const LW = Math.round((CONUS[2] - CONUS[0]) / 0.1) + 1;
export const LH = Math.round((CONUS[3] - CONUS[1]) / 0.1) + 1;
/** The 0.1° CONUS lattice as a grid, north row first. */
export const LATTICE: LatLonGrid = {
  kind: "latlon",
  ni: LW,
  nj: LH,
  lat1: CONUS[3],
  lon1: CONUS[0],
  di: 0.1,
  dj: 0.1,
  southward: true,
};

/** A native field on the lattice, each cell the most of the native points within `r`. */
export function toLattice(f: Field, r = 2) {
  const loc = locator(f.grid);
  const [w, h] = gridSize(f.grid);
  const out = new Float32Array(LW * LH);
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      const [fi, fj] = loc(CONUS[3] - j * 0.1, CONUS[0] + i * 0.1);
      const x = Math.round(fi);
      const y = Math.round(fj);
      let m = -Infinity;
      for (let b = Math.max(0, y - r); b <= Math.min(h - 1, y + r); b++)
        for (let a = Math.max(0, x - r); a <= Math.min(w - 1, x + r); a++) {
          const v = f.values[b * w + a];
          if (v > m) m = v;
        }
      out[j * LW + i] = m;
    }
  return out;
}

/** The lattice field's maximum (or minimum) within `r` cells, separably. */
function spread(v: Float32Array, r: number, min = false) {
  const pick = min ? Math.min : Math.max;
  const tmp = new Float32Array(v.length);
  const out = new Float32Array(v.length);
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      let m = v[j * LW + i];
      for (let a = Math.max(0, i - r); a <= Math.min(LW - 1, i + r); a++)
        m = pick(m, v[j * LW + a]);
      tmp[j * LW + i] = m;
    }
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      let m = tmp[j * LW + i];
      for (let b = Math.max(0, j - r); b <= Math.min(LH - 1, j + r); b++)
        m = pick(m, tmp[b * LW + i]);
      out[j * LW + i] = m;
    }
  return out;
}

const ymdh = (t: number) =>
  new Date(t).toISOString().slice(0, 13).replace(/[-T]/g, "");

/**
 * The RRFS ensemble's (REFS, 14 members) chance of new storms by hour for First Storms: its
 * neighborhood chance of a 40 dBZ echo, less the most it had within 25 miles the hour before
 * (storms already there or moving in), added up over the six hours as independent tries.
 */
async function refsNew(base: number, R: number) {
  const cycle = await latestCycle("refs");
  if (!cycle) return null;
  const t = cycleTime(cycle);
  const fhs = Array.from({ length: 7 }, (_, h) =>
    Math.round((base + h * 3600_000 - t) / 3600_000),
  );
  if (fhs[0] < 1 || fhs[6] > 48) return null;
  const read = (fh: number) =>
    record(
      MODELS.refs.url(cycle.slice(0, 8), cycle.slice(8), fh, "prob"),
      ":REFC:entire atmosphere",
      "prob >40",
    ).then((f) => toLattice(f, 1));
  const p = await Promise.all(fhs.map((fh) => read(fh).catch(() => null)));
  if (p.some((f) => !f)) return null;
  const n = LW * LH;
  const none = new Float32Array(n).fill(1);
  const when = new Float32Array(n).fill(Infinity);
  for (let h = 1; h < 7; h++) {
    const before = spread(p[h - 1]!, R);
    for (let i = 0; i < n; i++) {
      const fresh = clamp((p[h]![i] - before[i]) / 100);
      none[i] *= 1 - fresh;
      if (fresh >= 0.1 && when[i] === Infinity) when[i] = h;
    }
  }
  const chance = new Float32Array(n);
  for (let i = 0; i < n; i++) chance[i] = 1 - none[i];
  return { chance, when, cycle };
}

/** Lattice-sized IR frame (bytes, higher is warmer: ~0.6 K a step) from nowCOAST's GOES mosaic. */
async function irFrame(time: string) {
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: "goes_longwave_imagery",
    styles: "goes-lir",
    crs: "CRS:84",
    bbox: CONUS.join(","),
    width: String(LW * 2),
    height: String(LH * 2),
    format: "image/png",
    time,
  });
  const r = await fetch(
    `https://nowcoast.noaa.gov/geoserver/satellite/ows?${q}`,
    {
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 3600 },
    },
  );
  if (!r.ok || !r.headers.get("content-type")?.includes("png"))
    throw new Error(`GOES ${r.status}`);
  const { rgba } = decodePng(Buffer.from(await r.arrayBuffer()));
  // The style is a white-to-black ramp over the stored byte: white (0) is the coldest top.
  // Each lattice cell keeps its coldest of the four pixels; clear of data is NaN.
  const out = new Float32Array(LW * LH).fill(NaN);
  const W2 = LW * 2;
  for (let j = 0; j < LH * 2; j++)
    for (let i = 0; i < W2; i++) {
      const k = (j * W2 + i) * 4;
      if (rgba[k + 3] < 128) continue;
      const v = rgba[k];
      const q2 = (j >> 1) * LW + (i >> 1);
      if (!(out[q2] <= v)) out[q2] = v;
    }
  return out;
}

/**
 * Towers growing on GOES now (First Storms' first hour): cloud tops 6 K or more colder than
 * any top within about 20 km 15 minutes earlier (so drifting cloud doesn't count), between
 * about 230 and 275 K (growing cumulus, not old anvils or
 * clear ground). Returns 0, 1 (cooling) or 2 (cooling 12 K+) per lattice cell.
 */
async function coolingTops() {
  const caps = await fetch(
    "https://nowcoast.noaa.gov/geoserver/satellite/ows?service=WMS&version=1.3.0&request=GetCapabilities",
    { signal: AbortSignal.timeout(20000), next: { revalidate: 300 } },
  ).then((r) => (r.ok ? r.text() : ""));
  const i = caps.indexOf("<Name>goes_longwave_imagery</Name>");
  const dim =
    i < 0 ? null : /<Dimension name="time"[^>]*>([^<]+)</.exec(caps.slice(i));
  const times = dim?.[1].split(",").map((x) => x.trim()) ?? [];
  const now = times.at(-1);
  if (!now) return null;
  const then = [...times]
    .reverse()
    .find((x) => Date.parse(x) <= Date.parse(now) - 14 * 60_000);
  if (!then || Date.now() - Date.parse(now) > 40 * 60_000) return null;
  const [a, b] = await Promise.all([irFrame(then), irFrame(now)]);
  // Against the coldest top within ~20 km 15 minutes ago, so clouds drifting in don't count.
  for (let k = 0; k < a.length; k++) if (!(a[k] >= 0)) a[k] = 255;
  const before = spread(a, 2, true);
  const out = new Uint8Array(LW * LH);
  for (let k = 0; k < out.length; k++) {
    const d = before[k] - b[k];
    if (!(b[k] >= 95 && b[k] <= 168) || !(d >= 10)) continue;
    out[k] = d >= 20 ? 2 : 1;
  }
  return { cells: out, at: Date.parse(now) };
}

type Calib = { day: string; f: number[] };
/** First Storms' calibration bins (35–50%, 50–65%, 65%+). */
const FIRST_BINS = [35, 50, 65, 101];

/** Which calibration bin a value falls in (-1 below the first). */
export const binOf = (bins: number[], p: number) =>
  bins.findIndex((lo, k) => p >= lo && p < bins[k + 1]);

/**
 * How an engine's flagged values (the "(NN%)" or "(NN)" at the end of each flag's label)
 * have verified over the last 60 days, as a factor per bin: the observed share over the
 * forecast, pulled toward 1 until a bin has enough flags (shrinkage over 30) and kept within
 * 0.6–1.4. Worked out once a day and kept in private Storage (`calib/<engine>.json`).
 */
export async function calibBins(engine: string, bins: number[]) {
  const day = new Date().toISOString().slice(0, 10);
  const path = `calib/${engine}.json`;
  const kept = await readJson<Calib | null>(path, null);
  if (kept?.day === day && kept.f.length === bins.length - 1) return kept.f;
  const { data } = await supabaseAdmin()
    .from("engine_checks")
    .select("label, hit")
    .eq("engine", engine)
    .not("hit", "is", null)
    .gt("at", new Date(Date.now() - 60 * 86400_000).toISOString())
    .limit(5000);
  const sums = bins.slice(0, -1).map(() => ({ n: 0, hit: 0, p: 0 }));
  for (const r of data ?? []) {
    const p = Number(/\((\d+)%?\)\s*$/.exec(r.label ?? "")?.[1]);
    const b = binOf(bins, p);
    if (b < 0 || b >= sums.length) continue;
    sums[b].n++;
    sums[b].p += p / 100;
    if (r.hit) sums[b].hit++;
  }
  const f = sums.map(({ n, hit, p }) => {
    if (!n) return 1;
    const raw = (hit + 0.5) / (n + 1) / (p / n);
    return (
      Math.round(clamp(1 + (raw - 1) * (n / (n + 30)), 0.6, 1.4) * 100) / 100
    );
  });
  await writeJson(path, { day, f }).catch(() => undefined);
  return f;
}

/**
 * First Storms: the chance new storms start within about 25 miles over the next 6 hours,
 * from the last four HRRR runs together (a time-lagged ensemble). In each run a new storm is
 * a 35 dBZ echo with none within 25 miles the hour before; the chance is the share of runs
 * that start one nearby, weighed by whether the newest run has the cap weakening and the
 * surface winds converging, and only where there is instability to use (MUCAPE ≥ 100).
 */
async function first(cycle: string): Promise<Computed> {
  const t0 = cycleTime(cycle);
  const base = Math.floor(Date.now() / 3600_000) * 3600_000;
  const R = 4;
  const n = LW * LH;
  const votes = new Float32Array(n);
  const whenSum = new Float32Array(n);
  const whenN = new Float32Array(n);
  let runs = 0;
  for (let k = 0; k < 4; k++) {
    const c = ymdh(t0 - k * 3600_000);
    const hrs = Array.from({ length: 7 }, (_, h) =>
      Math.round((base + h * 3600_000 - cycleTime(c)) / 3600_000),
    );
    if (hrs.some((fh) => fh < 0 || fh > 18)) continue;
    const refl = await Promise.all(
      hrs.map((fh) =>
        grab(c, fh, [":REFC:entire atmosphere:"])
          .then(([f]) => toLattice(f))
          .catch(() => null),
      ),
    );
    if (refl.some((f) => !f)) continue;
    runs++;
    const when = new Float32Array(n).fill(Infinity);
    let near = spread(refl[0]!, R);
    for (let h = 1; h < 7; h++) {
      const f = refl[h]!;
      for (let i = 0; i < n; i++)
        if (f[i] >= 35 && near[i] < 35 && when[i] === Infinity) when[i] = h;
      near = spread(f, R);
    }
    const soon = spread(when, R, true);
    for (let i = 0; i < n; i++)
      if (soon[i] < Infinity) {
        votes[i]++;
        whenSum[i] += soon[i];
        whenN[i]++;
      }
  }
  if (!runs) throw new Error("No HRRR runs cover the next 6 hours");
  // More members (post-launch A6): the RRFS ensemble's 14, the satellite's first hour, and
  // the calibration from how flagged chances verified.
  const [refs, sat, calib, storms] = await Promise.all([
    refsNew(base, R).catch(() => null),
    coolingTops().catch(() => null),
    calibBins("first", FIRST_BINS).catch(() => [1, 1, 1]),
    import("./probsevere")
      .then(async (m) => {
        const name = (await m.fileNames()).at(-1);
        return name ? m.cells(await m.file(name)) : [];
      })
      .catch(() => []),
  ]);
  // Satellite towers count only away from storms radar already has (40 km).
  const taken = new Uint8Array(n);
  for (const c of storms) {
    const q = latticeCell(c.lat, c.lon);
    if (q < 0) continue;
    const ci = q % LW;
    const cj = (q - ci) / LW;
    for (let b = Math.max(0, cj - 4); b <= Math.min(LH - 1, cj + 4); b++)
      for (let a = Math.max(0, ci - 5); a <= Math.min(LW - 1, ci + 5); a++)
        taken[b * LW + a] = 1;
  }
  const tower = new Float32Array(n);
  if (sat)
    for (let i = 0; i < n; i++)
      if (sat.cells[i] && !taken[i]) tower[i] = sat.cells[i];
  const towers = spread(tower, 2);
  const members = runs + (refs ? 14 : 0);
  const fh = hourFor(cycle, base + 3 * 3600_000);
  const [[cape, u10, v10, land], [cinNow], [cinLater]] = await Promise.all([
    grab(cycle, fh, [
      ":CAPE:255-0 mb above ground:",
      ":UGRD:10 m above ground:",
      ":VGRD:10 m above ground:",
      ":LAND:surface:",
    ]),
    grab(cycle, hourFor(cycle, base + 3600_000), [
      ":CIN:90-0 mb above ground:",
    ]),
    grab(cycle, hourFor(cycle, base + 4 * 3600_000), [
      ":CIN:90-0 mb above ground:",
    ]),
  ]);
  const g = cape.grid;
  const [w, h] = gridSize(g);
  const dx = g.kind === "lambert" ? g.dx : 3000;
  const div = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      div[k] =
        (u10.values[k + 1] - u10.values[k - 1]) / (2 * dx) +
        (v10.values[k + w] - v10.values[k - w]) / (2 * dx);
    }
  const conv = smooth(div, w, h, 6);
  const loc = locator(g);
  const prob = new Float32Array(n);
  const time = new Float32Array(n);
  const factors = new Uint8Array(n);
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      const q = j * LW + i;
      if (!votes[q] && !(refs && refs.chance[q] >= 0.05) && !towers[q])
        continue;
      const [fi, fj] = loc(CONUS[3] - j * 0.1, CONUS[0] + i * 0.1);
      const x = Math.round(fi);
      const y = Math.round(fj);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = y * w + x;
      // Over land only: storms over open water start daily and matter to no one chasing.
      if (!(cape.values[k] >= 100) || land.values[k] < 0.5) continue;
      const weaker = cinLater.values[k] - cinNow.values[k] >= 10;
      const none = cinLater.values[k] > -25;
      const cap = weaker || none;
      const meet = conv[k] < -1e-5;
      factors[q] =
        (weaker ? 1 : 0) + (meet ? 2 : 0) + (!weaker && none ? 4 : 0);
      const share = (votes[q] + (refs ? 14 * refs.chance[q] : 0)) / members;
      let p =
        100 * share * (0.75 + 0.125 * (cap ? 1 : 0) + 0.125 * (meet ? 1 : 0));
      // A tower already growing makes the first hour near-certain where it is.
      if (towers[q]) {
        p = Math.max(p, towers[q] >= 2 ? 80 : 60);
        factors[q] |= 8;
      }
      prob[q] = p;
      let wSum = whenSum[q];
      let wN = whenN[q];
      if (refs && refs.when[q] < Infinity) {
        wSum += refs.when[q] * 2;
        wN += 2;
      }
      if (towers[q]) {
        wSum += 0.5 * 4;
        wN += 4;
      }
      whenSum[q] = wSum;
      whenN[q] = wN;
      // Earlier is higher, so the nested timing areas put the soonest on top.
      if (prob[q] >= 15 && wN) time[q] = 7 - wSum / wN;
    }
  // Neighborhood odds, smoothed over about 40 km the way SPC's guidance is, then calibrated.
  const smoothed = smooth(smooth(prob, LW, LH, 2), LW, LH, 2);
  for (let q = 0; q < n; q++) {
    const p = Math.max(smoothed[q], towers[q] ? prob[q] * 0.9 : 0);
    const b = binOf(FIRST_BINS, p);
    prob[q] = clamp(p * (calib[Math.max(0, b)] ?? 1), 0, 100);
  }
  const at = (lat: number, lon: number) => {
    const i = Math.round((lon - CONUS[0]) / 0.1);
    const j = Math.round((CONUS[3] - lat) / 0.1);
    return i >= 0 && j >= 0 && i < LW && j < LH ? j * LW + i : -1;
  };
  return {
    field: { grid: LATTICE, values: prob },
    cycle,
    fh,
    alt: { field: { grid: LATTICE, values: time }, levels: [1, 3, 5] },
    nearMiles: 40,
    note:
      [
        runs < 4 ? `${runs} of the last 4 HRRR runs reach 6 hours ahead.` : "",
        refs ? "" : "The RRFS ensemble isn't in yet, so this is HRRR only.",
        sat
          ? ""
          : "Satellite isn't answering, so the first hour is model only.",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    detail: (lat, lon) => {
      const q = at(lat, lon);
      if (q < 0 || !whenN[q]) return undefined;
      const why = [
        factors[q] & 1 ? "cap weakening" : "",
        factors[q] & 4 ? "little or no cap" : "",
        factors[q] & 2 ? "winds converging" : "",
        factors[q] & 8 ? "towers growing on satellite" : "",
      ].filter(Boolean);
      const ens = refs ? ` + RRFS ${Math.round(refs.chance[q] * 100)}%` : "";
      return `${votes[q]} of ${runs} HRRR runs${ens}${why.length ? ` · ${why.join(", ")}` : ""}`;
    },
    when: (lat, lon) => {
      const q = at(lat, lon);
      return q < 0 || !whenN[q]
        ? undefined
        : base + Math.round(whenSum[q] / whenN[q]) * 3600_000;
    },
    flags: (spots) =>
      spots
        .filter((x) => x.value >= 35)
        .map((x) => ({
          key: `${cycle}:${x.lat.toFixed(1)},${x.lon.toFixed(1)}`,
          at: base,
          lat: x.lat,
          lon: x.lon,
          label: `${x.place} (${Math.round(x.value)}%)`,
          window_min: 360,
          radius_km: 40,
        })),
  };
}

/** An engine's factor weights tuned from members' reports (lib/engines/tune.ts), or none. */
export async function tuned(id: string): Promise<Weights> {
  const { data } = await supabaseAdmin()
    .from("app_config")
    .select("value")
    .eq("key", "engine_weights")
    .maybeSingle();
  return ((data?.value ?? {}) as Record<string, Weights>)[id] ?? {};
}

const GLOW_FIELDS = [
  ":LCDC:low cloud layer:",
  ":MCDC:middle cloud layer:",
  ":HCDC:high cloud layer:",
  ":AOTK:entire atmosphere",
  ":TMP:2 m above ground:",
  ":DPT:2 m above ground:",
];
const PATH_KM = [60, 120, 200, 300, 400];

/** A point `km` away on a compass bearing (flat-earth, fine at these distances). */
const toward = (lat: number, lon: number, az: number, km: number) => {
  const r = (az * Math.PI) / 180;
  return [
    lat + (km * Math.cos(r)) / 111.32,
    lon + (km * Math.sin(r)) / (111.32 * Math.cos((lat * Math.PI) / 180)),
  ];
};

/** The run (newest, or the newest 48-hour one) and hour that cover a valid time, or null. */
async function runFor(cycle: string, at: number, long?: string | null) {
  const fh = Math.round((at - cycleTime(cycle)) / 3600_000);
  if (fh >= 0 && fh <= 18) return { run: cycle, fh };
  if (!long) return null;
  const lf = Math.round((at - cycleTime(long)) / 3600_000);
  return lf >= 0 && lf <= 48 ? { run: long, fh: lf } : null;
}

/** The glow inputs at one place and time, from the HRRR (members' sunset ratings). */
export async function glowAt(lat: number, lon: number, at: number) {
  const cycle = await latestCycle("hrrr");
  if (!cycle) return null;
  const r = await runFor(cycle, at, await longRun(cycle));
  if (!r) return null;
  const [f, [pr]] = await Promise.all([
    grab(r.run, r.fh, GLOW_FIELDS),
    r.fh >= 2
      ? grab(r.run, r.fh - 2, [":PRATE:surface:"])
      : Promise.resolve([null]),
  ]);
  const loc = locator(f[0].grid);
  const [w, h] = gridSize(f[0].grid);
  const idx = (la: number, lo: number) => {
    const [fi, fj] = loc(la, lo);
    const x = Math.round(fi);
    const y = Math.round(fj);
    return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
  };
  const az = sunPosition(new Date(at), lat, lon).azimuth;
  return glowInputs(f, pr, idx, lat, lon, az);
}

function glowInputs(
  f: Field[],
  pr: Field | null,
  idx: (lat: number, lon: number) => number,
  lat: number,
  lon: number,
  az: number,
): GlowInputs | null {
  const [low, mid, high, aot, t2, d2] = f;
  const k = idx(lat, lon);
  if (k < 0) return null;
  const path = PATH_KM.flatMap((km) => {
    const [la, lo] = toward(lat, lon, az, km);
    const q = idx(la, lo);
    return q < 0 ? [] : [Math.max(low.values[q], mid.values[q])];
  });
  return {
    low: low.values[k],
    mid: mid.values[k],
    high: high.values[k],
    path,
    aot: aot.values[k],
    rh: (100 * es(d2.values[k] - 273.15)) / es(t2.values[k] - 273.15),
    rained: (pr?.values[k] ?? 0) * 3600 > 0.1,
  };
}

/**
 * Sunset (and Sunrise) Quality: at each place's own next sunset, the HRRR's clouds overhead
 * and along the line toward the sun, smoke and humidity, scored by lib/engines/outdoor.ts.
 * Places are grouped by the hour of their sunset; each hour's fields are read once.
 */
async function glowMap(
  cycle: string,
  kind: "sunset" | "sunrise",
  w: Weights,
  long: string | null,
  deadline: number,
) {
  const now = Date.now() - 20 * 60_000;
  // Each 1° cell's event time and the sun's bearing then.
  const CW = 61;
  const CH = 28;
  const ev = new Float64Array(CW * CH).fill(NaN);
  const az = new Float32Array(CW * CH);
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const lat = CONUS[1] + j;
      const lon = CONUS[0] + i;
      const t = nextSunEvent(kind, lat, lon, new Date(now));
      if (!t) continue;
      ev[j * CW + i] = t.getTime();
      az[j * CW + i] = sunPosition(t, lat, lon).azimuth;
    }
  const cellOf = (lat: number, lon: number) =>
    Math.min(CH - 1, Math.max(0, Math.round(lat - CONUS[1]))) * CW +
    Math.min(CW - 1, Math.max(0, Math.round(lon - CONUS[0])));
  const out = new Float32Array(LW * LH).fill(NaN);
  const parts = new Map<number, ReturnType<typeof glowFactors>>();
  const hours = [
    ...new Set(
      [...ev].filter(Number.isFinite).map((t) => Math.round(t / 3600_000)),
    ),
  ].sort((a, b) => a - b);
  let done = 0;
  for (const hr of hours) {
    if (Date.now() > deadline) break;
    const r = await runFor(cycle, hr * 3600_000, long);
    if (!r) continue;
    const [f, [pr]] = await Promise.all([
      grab(r.run, r.fh, GLOW_FIELDS),
      r.fh >= 2
        ? grab(r.run, r.fh - 2, [":PRATE:surface:"])
        : Promise.resolve([null]),
    ]);
    const loc = locator(f[0].grid);
    const [gw, gh] = gridSize(f[0].grid);
    const idx = (la: number, lo: number) => {
      const [fi, fj] = loc(la, lo);
      const x = Math.round(fi);
      const y = Math.round(fj);
      return x < 0 || y < 0 || x >= gw || y >= gh ? -1 : y * gw + x;
    };
    for (let j = 0; j < LH; j++)
      for (let i = 0; i < LW; i++) {
        const lat = CONUS[3] - j * 0.1;
        const lon = CONUS[0] + i * 0.1;
        const c = cellOf(lat, lon);
        if (Math.round(ev[c] / 3600_000) !== hr) continue;
        const x = glowInputs(f, pr, idx, lat, lon, az[c]);
        if (!x) continue;
        const fac = glowFactors(x);
        out[j * LW + i] = glowScore(fac, w);
        parts.set(j * LW + i, fac);
      }
    done++;
  }
  return { out, ev, cellOf, parts, done, of: hours.length };
}

async function sunset(cycle: string): Promise<Computed> {
  const start = Date.now();
  const [w, long] = await Promise.all([tuned("sunset"), longRun(cycle)]);
  const set = await glowMap(cycle, "sunset", w, long, start + 30_000);
  const rise = await glowMap(cycle, "sunrise", w, long, start + 42_000);
  const say = (fac: ReturnType<typeof glowFactors> | undefined) => {
    if (!fac) return "";
    const bits = [
      fac.canvas >= 0.7
        ? "clouds overhead to catch the light"
        : fac.canvas < 0.3
          ? "too few clouds for color"
          : "",
      fac.horizon >= 0.75 ? "clear toward the sun" : "",
      fac.smoke > 1.05 ? "a little smoke for deeper reds" : "",
      fac.smoke < 0.8 ? "heavy smoke" : "",
      fac.rain > 1 ? "fresh air after rain" : "",
    ].filter(Boolean);
    return bits.join(", ");
  };
  const at = (lat: number, lon: number) => {
    const i = Math.round((lon - CONUS[0]) / 0.1);
    const j = Math.round((CONUS[3] - lat) / 0.1);
    return j * LW + i;
  };
  return {
    field: { grid: LATTICE, values: set.out },
    cycle,
    fh: 1,
    alt: {
      field: { grid: LATTICE, values: rise.out },
      levels: [20, 40, 60, 80],
    },
    nearMiles: 60,
    note:
      set.done < set.of || rise.done < rise.of
        ? "Part of the country is still to come; the map fills in on the next run."
        : undefined,
    detail: (lat, lon) => say(set.parts.get(at(lat, lon))) || undefined,
    when: (lat, lon) => set.ev[set.cellOf(lat, lon)] || undefined,
    altDetail: (lat, lon) => say(rise.parts.get(at(lat, lon))) || undefined,
    altWhen: (lat, lon) => rise.ev[rise.cellOf(lat, lon)] || undefined,
  };
}

const COMPUTE: Record<FieldId, (cycle: string) => Promise<Computed>> = {
  llj,
  nst,
  pyro,
  tctor,
  stp,
  scp,
  dcp,
  ltg,
  rwrap,
  blizz,
  first,
  sunset,
  bound,
};

export type Spot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  water?: boolean;
  note?: string;
  at?: number;
};

/** The strongest separate spots on a 0.25° lattice, named by the nearest town. */
function spots(c: Computed, min: number, n = 6): Spot[] {
  const [W, S, E, N] = CONUS;
  const loc = locator(c.field.grid);
  const [w, h] = gridSize(c.field.grid);
  const land = c.extra?.land as Float32Array | undefined;
  const all: Spot[] = [];
  for (let lat = S; lat <= N; lat += 0.25)
    for (let lon = W; lon <= E; lon += 0.25) {
      if (c.keep && !c.keep(lat, lon)) continue;
      const [fi, fj] = loc(lat, lon);
      const i = Math.round(fi);
      const j = Math.round(fj);
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const v = c.field.values[j * w + i];
      if (v >= min)
        all.push({
          lat,
          lon,
          value: v,
          place: "",
          water: land ? land[j * w + i] < 0.5 : undefined,
        });
    }
  all.sort((a, b) => b.value - a.value);
  places ??= parsePlaces(PLACES);
  const rows = places;
  const pickd: Spot[] = [];
  for (const s of all) {
    if (pickd.some((p) => distKm(p.lat, p.lon, s.lat, s.lon) < 250)) continue;
    // Over 100 miles from any U.S. town is Canada, Mexico or open sea: not listed.
    const near = nearestPlace(rows, s.lat, s.lon, 2000);
    if (!near || near.miles > (c.nearMiles ?? 100)) continue;
    pickd.push({
      ...s,
      value: Math.round(s.value * 10) / 10,
      place: `${near.miles < 5 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`,
      note: c.detail?.(s.lat, s.lon),
      at: c.when?.(s.lat, s.lon),
    });
    if (pickd.length >= n) break;
  }
  return pickd;
}

const STEP = 0.1;

/**
 * The field as nested band areas, SPC-style: sampled on a 0.1° lattice (outside `keep`
 * counts as nothing), softened once so the edges read as areas, then contoured per band.
 */
function areasOf(c: Computed, levels: number[]) {
  const [W, S, E, N] = CONUS;
  const loc = locator(c.field.grid);
  const [gw, gh] = gridSize(c.field.grid);
  const w = Math.round((E - W) / STEP) + 1;
  const h = Math.round((N - S) / STEP) + 1;
  const v = new Float32Array(w * h).fill(NaN);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const lat = N - j * STEP;
      const lon = W + i * STEP;
      if (c.keep && !c.keep(lat, lon)) continue;
      const [fi, fj] = loc(lat, lon);
      const x = Math.round(fi);
      const y = Math.round(fj);
      if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
      const q = c.field.values[y * gw + x];
      if (Number.isFinite(q)) v[j * w + i] = q;
    }
  // Hot-Dry-Windy follows the terrain cell by cell; a second pass keeps its areas readable.
  const passes = c.rough ? 2 : 1;
  return latticeAreas(soften(v, w, h, passes), w, h, W, N, STEP, levels);
}

/**
 * The evening-parameter engines' top spots at their second band or higher, checked against
 * the evening's storm reports (post-launch A1 "skill-scores"): from 3 hours before the valid
 * time to 6 after, within the radius. One flag per evening per whole-degree square, so each
 * new HRRR run doesn't count the same setup again.
 */
const EVENING: Partial<Record<FieldId, number>> = {
  stp: 80,
  scp: 80,
  dcp: 100,
  nst: 60,
  tctor: 80,
};
export function eveningFlags(
  id: FieldId,
  valid: number,
  top: Spot[],
  min: number,
): Flag[] {
  const radius = EVENING[id];
  if (!radius) return [];
  const day = new Date(valid).toISOString().slice(0, 10);
  return top
    .filter((x) => x.value >= min)
    .map((x) => ({
      key: `${day}:${Math.round(x.lat)},${Math.round(x.lon)}`,
      at: valid - 3 * 3600_000,
      lat: x.lat,
      lon: x.lon,
      label: `${x.place} (${id.toUpperCase()} ${x.value})`,
      window_min: 540,
      radius_km: radius,
    }));
}

/** One engine's map (nested band areas over CONUS) and what to list beside it. */
export async function fieldEngine(id: FieldId) {
  const cycle = await latestCycle("hrrr");
  if (!cycle) throw new Error("No HRRR run is available");
  const c = await COMPUTE[id](cycle);
  const bands = FIELD_BANDS[id];
  const top = id === "pyro" || id === "bound" ? [] : spots(c, bands.levels[0]);
  const flags = c.flags
    ? c.flags(top)
    : eveningFlags(
        id,
        cycleTime(cycle) + c.fh * 3600_000,
        top,
        bands.levels[1] ?? bands.levels[0],
      );
  if (flags.length) await logFlags(id, flags).catch(() => {});
  return {
    id,
    cycle,
    fh: c.fh,
    valid: new Date(cycleTime(cycle) + c.fh * 3600_000).toISOString(),
    bounds: CONUS,
    areas: areasOf(c, bands.levels),
    alt: c.alt ? areasOf({ ...c, field: c.alt.field }, c.alt.levels) : null,
    altSpots:
      c.alt && c.altDetail
        ? spots(
            { ...c, field: c.alt.field, detail: c.altDetail, when: c.altWhen },
            c.alt.levels[0],
          )
        : null,
    spots: top,
    fires: (c.extra?.fires as unknown[]) ?? undefined,
    storms: (c.extra?.storms as unknown[]) ?? undefined,
    points: (c.extra?.points as unknown[]) ?? undefined,
    note: c.note ?? null,
  };
}

/** Admin color preview: today's band areas, and the fires (PyroCb) with their chances. */
export async function fieldPreview(id: FieldId) {
  const cycle = await latestCycle("hrrr");
  if (!cycle) return { areas: null, fires: [] };
  const c = await COMPUTE[id](cycle);
  const fires = (c.extra?.fires ?? []) as {
    lat: number;
    lon: number;
    chance: number;
  }[];
  return {
    areas: areasOf(c, FIELD_BANDS[id].levels),
    alt: c.alt ? areasOf({ ...c, field: c.alt.field }, c.alt.levels) : null,
    fires,
    points: (c.extra?.points ?? []) as {
      lat: number;
      lon: number;
      score: number;
    }[],
  };
}
