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
import { getOutlook } from "@/lib/tropical/nhc";
import { latticeAreas, soften } from "./areas";
import { FIELD_BANDS, type FieldId } from "./colors";
import { logFlags, type Flag } from "./verify";

/**
 * The model-driven Weather Engines (Extras). Each reads a handful of HRRR fields by byte range
 * from NOAA's AWS archive (the same reader as the model viewer) and combines them into one
 * index, painted as a transparent map layer in the admin-editable band colors.
 */
const CONUS = REGIONS.conus.b;
const KT = 1.943844;
let places: ReturnType<typeof parsePlaces> | null = null;

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const hypot = (a: Float32Array, b: Float32Array) => {
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = Math.hypot(a[i], b[i]);
  return o;
};
const cycleTime = (c: string) =>
  Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8));

/** The forecast hour of `cycle` closest to `at`, inside the HRRR's 18 hours. */
const hourFor = (cycle: string, at: number) =>
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

async function grab(cycle: string, fh: number, matches: string[]) {
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
type Computed = {
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
  /** A line under each listed spot (when, why). */
  detail?: (lat: number, lon: number) => string | undefined;
  /** Listed spots must be this close to a U.S. town (default 100 miles). */
  nearMiles?: number;
  /** A second map of the same engine, with its own bands (First Storms' timing). */
  alt?: { field: Field; levels: number[] };
};

/** Nocturnal LLJ Ramp-Up, valid at the coming 06Z (about 1 a.m. Central). */
async function llj(cycle: string): Promise<Computed> {
  const target = nextUtc(6, 1);
  const fh = hourFor(cycle, target);
  // The ramp-up is measured against six hours earlier (about 7 p.m. Central).
  const base = hourFor(cycle, target - 6 * 3600_000);
  const [u8, v8, u9, v9, srh, cape, ps, land] = await grab(cycle, fh, [
    ":UGRD:850 mb:",
    ":VGRD:850 mb:",
    ":UGRD:925 mb:",
    ":VGRD:925 mb:",
    ":HLCY:1000-0 m above ground:",
    ":CAPE:180-0 mb above ground:",
    ":PRES:surface:",
    ":LAND:surface:",
  ]);
  const [bu8, bv8, bu9, bv9] = await grab(cycle, base, [
    ":UGRD:850 mb:",
    ":VGRD:850 mb:",
    ":UGRD:925 mb:",
    ":VGRD:925 mb:",
  ]);
  const s8 = hypot(u8.values, v8.values);
  const s9 = hypot(u9.values, v9.values);
  const b8 = hypot(bu8.values, bv8.values);
  const b9 = hypot(bu9.values, bv9.values);
  const n = s8.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = ps.values[i] / 100;
    // A pressure level below the ground is the model's extrapolation, not wind.
    const use9 = p >= 950;
    // The nocturnal jet is a land phenomenon (the ground cooling at night); skip the sea.
    if (p < 880 || land.values[i] < 0.5) {
      out[i] = NaN;
      continue;
    }
    const jet = Math.max(s8[i], use9 ? s9[i] : 0) * KT;
    const was = Math.max(b8[i], use9 ? b9[i] : 0) * KT;
    const jt = clamp((jet - 25) / 25);
    const rt = clamp((jet - was) / 15);
    const st = clamp(srh.values[i] / 200);
    const ct = clamp(cape.values[i] / 1000);
    out[i] = 100 * jt * (0.4 + 0.6 * rt) * (0.5 + 0.5 * st) * (0.5 + 0.5 * ct);
  }
  return {
    field: { grid: u8.grid, values: out },
    cycle,
    fh,
  };
}

/** Box-average a grid in place-free fashion (radius r cells), for smoothing a derivative. */
function smooth(v: Float32Array, w: number, h: number, r: number) {
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
  // Waterspouts count within ~60 km of land (bays, sounds, the Great Lakes, near shore).
  const coast = smooth(land.values, w, h, 20);
  const out = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) {
    if (land.values[k] < 0.5 && coast[k] <= 0) continue;
    const dz = (z8.values[k] - zs.values[k]) / 1000;
    if (!(dz > 0.3 && dz < 2)) continue;
    const lapse = (t2.values[k] - t8.values[k]) / dz;
    const shear = Math.hypot(us.values[k], vs.values[k]);
    const a = clamp(lapse / 9, 0, 1.5);
    const b = clamp(cape.values[k] / 100, 0, 3);
    const c = clamp((225 + cin.values[k]) / 200, 0, 1.2);
    const d = clamp((18 - shear) / 5, 0, 2);
    const e = clamp(vort[k] / 8e-5, 0, 3);
    out[k] = a * b * c * d * e;
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
const distKm = (a: number, b: number, c: number, d: number) => {
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

/** SPC's fixed-layer Significant Tornado Parameter, at this evening's peak (00Z). */
async function stp(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, nextUtc(0, 1));
  const [cape, cin, lcl, zs, srh, us, vs] = await grab(cycle, fh, [
    ":CAPE:surface:",
    ":CIN:surface:",
    ":HGT:level of adiabatic condensation from sfc:",
    ":HGT:surface:",
    ":HLCY:1000-0 m above ground:",
    ":VUCSH:0-6000 m above ground:",
    ":VVCSH:0-6000 m above ground:",
  ]);
  const out = new Float32Array(cape.values.length);
  for (let i = 0; i < out.length; i++) {
    // The LCL comes as a height above sea level; the term wants it above the ground.
    const lc = lcl.values[i] - zs.values[i];
    const lt = lc < 1000 ? 1 : lc > 2000 ? 0 : (2000 - lc) / 1000;
    const sh = bulk(us.values[i], vs.values[i]);
    const st = sh < 12.5 ? 0 : sh > 30 ? 1.5 : sh / 20;
    const ci = cin.values[i];
    const ct = ci > -50 ? 1 : ci < -200 ? 0 : (200 + ci) / 150;
    out[i] = Math.max(
      0,
      (cape.values[i] / 1500) * lt * (srh.values[i] / 150) * st * ct,
    );
  }
  return { field: { grid: cape.grid, values: out }, cycle, fh };
}

/** SPC's Supercell Composite Parameter (most-unstable parcel), at this evening's peak. */
async function scp(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, nextUtc(0, 1));
  const [mu, mucin, srh, us, vs] = await grab(cycle, fh, [
    ":CAPE:255-0 mb above ground:",
    ":CIN:255-0 mb above ground:",
    ":HLCY:3000-0 m above ground:",
    ":VUCSH:0-6000 m above ground:",
    ":VVCSH:0-6000 m above ground:",
  ]);
  const out = new Float32Array(mu.values.length);
  for (let i = 0; i < out.length; i++) {
    const sh = bulk(us.values[i], vs.values[i]);
    const st = sh < 10 ? 0 : sh > 20 ? 1 : sh / 20;
    const c = mucin.values[i];
    const ct = c > -40 ? 1 : -40 / c;
    // Negative is a left-moving supercell's; the map shows right movers.
    out[i] = Math.max(
      0,
      (mu.values[i] / 1000) * (srh.values[i] / 50) * st * ct,
    );
  }
  return { field: { grid: mu.grid, values: out }, cycle, fh };
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
  return { field: { grid: mu.grid, values: out }, cycle, fh };
}

/** The HRRR's own lightning threat (flashes per km² per 5 minutes), the most over 3 hours. */
async function ltg(cycle: string): Promise<Computed> {
  const fh = hourFor(cycle, Date.now() + 3600_000);
  const hours = [fh, fh + 1, fh + 2].filter((h) => h <= 18);
  const runs = await Promise.all(
    hours.map((h) => grab(cycle, h, [":LTNG:entire atmosphere:"])),
  );
  const first = runs[0][0];
  const out = new Float32Array(first.values.length);
  for (const [r] of runs)
    for (let i = 0; i < out.length; i++)
      if (r.values[i] > out[i]) out[i] = r.values[i];
  return { field: { grid: first.grid, values: out }, cycle, fh };
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
  const [mu, mucin, srh, us, vs, ust, vst, u25, v25, u30, v30, pw, lcl, zs] =
    await grab(cycle, fh, [
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
    ]);
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
    const sr = Math.hypot(
      (u25.values[i] + u30.values[i]) / 2 - ust.values[i],
      (v25.values[i] + v30.values[i]) / 2 - vst.values[i],
    );
    const wind = clamp((28 - sr) / 10);
    const wet = clamp((pw.values[i] - 20) / 20);
    const base = clamp((1500 - (lcl.values[i] - zs.values[i])) / 1000);
    out[i] = Math.max(1, 100 * (0.6 * wind + 0.3 * wet + 0.1 * base));
  }
  return { field: { grid: mu.grid, values: out }, cycle, fh };
}

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
  const [snodNear] = await grab(cycle, 1, [":SNOD:surface:"]);
  const n = snodNear.values.length;
  const hours = new Float32Array(n);
  const first = new Float32Array(n).fill(NaN);
  const last = new Float32Array(n);
  let snod = snodNear.values;
  let through = 0;
  for (let k = 0; k < steps.length; k += 3) {
    if (Date.now() - start > 35_000) break;
    const batch = steps.slice(k, k + 3);
    const got = await Promise.all(
      batch.map((st) =>
        grab(st.c, st.fh, [
          ":GUST:surface:",
          ":VIS:surface:",
          ":CSNOW:surface:",
          ":TMP:2 m above ground:",
          ...(st.c === long && st.at === 20 ? [":SNOD:surface:"] : []),
        ]),
      ),
    );
    batch.forEach((st, b) => {
      const [g, v, cs, t2, sd] = got[b];
      if (sd) snod = sd.values;
      for (let i = 0; i < n; i++) {
        const mph = g.values[i] * 2.237;
        if (mph < 35) continue;
        const falling = cs.values[i] >= 0.5 && v.values[i] <= 800;
        const blowing = snod[i] >= 0.05 && t2.values[i] <= 268.15 && mph >= 40;
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
      through < 47
        ? `Counted through the next ${Math.round(through)} hours.`
        : undefined,
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

const LW = Math.round((CONUS[2] - CONUS[0]) / 0.1) + 1;
const LH = Math.round((CONUS[3] - CONUS[1]) / 0.1) + 1;
/** The 0.1° CONUS lattice as a grid, north row first. */
const LATTICE: LatLonGrid = {
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
function toLattice(f: Field, r = 2) {
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
const clock = (t: number) =>
  new Date(t).toLocaleTimeString("en-US", {
    hour: "numeric",
    timeZone: "America/Chicago",
  });

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
      if (!votes[q]) continue;
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
      prob[q] =
        100 *
        (votes[q] / runs) *
        (0.75 + 0.125 * (cap ? 1 : 0) + 0.125 * (meet ? 1 : 0));
      // Earlier is higher, so the nested timing areas put the soonest on top.
      if (prob[q] >= 15) time[q] = 7 - whenSum[q] / whenN[q];
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
      runs < 4
        ? `${runs} of the last 4 HRRR runs reach 6 hours ahead; the chance uses those.`
        : undefined,
    detail: (lat, lon) => {
      const q = at(lat, lon);
      if (q < 0 || !whenN[q]) return undefined;
      const why = [
        factors[q] & 1 ? "cap weakening" : "",
        factors[q] & 4 ? "little or no cap" : "",
        factors[q] & 2 ? "winds converging" : "",
      ].filter(Boolean);
      return `First storms around ${clock(base + Math.round(whenSum[q] / whenN[q]) * 3600_000)} CT · ${votes[q]} of ${runs} runs${why.length ? ` · ${why.join(", ")}` : ""}`;
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
};

export type Spot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  water?: boolean;
  note?: string;
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

/** One engine's map (nested band areas over CONUS) and what to list beside it. */
export async function fieldEngine(id: FieldId) {
  const cycle = await latestCycle("hrrr");
  if (!cycle) throw new Error("No HRRR run is available");
  const c = await COMPUTE[id](cycle);
  const bands = FIELD_BANDS[id];
  const top = id === "pyro" ? [] : spots(c, bands.levels[0]);
  if (c.flags) await logFlags(id, c.flags(top)).catch(() => {});
  return {
    id,
    cycle,
    fh: c.fh,
    valid: new Date(cycleTime(cycle) + c.fh * 3600_000).toISOString(),
    bounds: CONUS,
    areas: areasOf(c, bands.levels),
    alt: c.alt ? areasOf({ ...c, field: c.alt.field }, c.alt.levels) : null,
    spots: top,
    fires: (c.extra?.fires as unknown[]) ?? undefined,
    storms: (c.extra?.storms as unknown[]) ?? undefined,
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
  };
}
