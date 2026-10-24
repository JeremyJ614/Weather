import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { gridSize, locator } from "@/lib/models/grib2";
import {
  CONUS,
  LATTICE,
  LH,
  LW,
  cycleTime,
  distKm,
  grab,
  hourFor,
  smooth,
  type Computed,
} from "./fields";

/**
 * Boundary Collision Analyzer (Extras engine), the owner's design:
 *  1. Ingest the newest HRRR run (now to +3 h), airport observations (IEM) and the Weather
 *     Prediction Center's analyzed fronts.
 *  2. Normalize each into boundaries on the 0.1° lattice: lines of converging surface wind
 *     with a sharp temperature change (fronts, outflow) or dew-point change (drylines).
 *  3. Detect candidates: connected stretches at least ~50 km long.
 *  4. Associate them hour to hour by distance, which gives each one's movement.
 *  5–6. Find where two meet: two boundaries joining from one hour to the next, or a
 *     temperature boundary running into a moisture boundary.
 *  7. Weigh the environment there (CAPE, CIN, low-level spin, deep shear).
 *  8. Summarize the evidence: which sources agree.
 *  9–10. Each strong collision is logged and later checked against radar (storms forming
 *     within 25 miles), and the hit rate shown.
 */
export type Collision = {
  lat: number;
  lon: number;
  place: string;
  /** When they meet (ms) and how sure the timing is (± minutes). */
  at: number;
  spread: number;
  kinds: string;
  score: number;
  evidence: string[];
};

const TEMP = 1;
const MOIST = 2;
const KIND = ["", "temperature", "moisture", "temperature and moisture"];
let places: ReturnType<typeof parsePlaces> | null = null;

/** Boundary cells at one hour: 1 temperature, 2 moisture, 3 both (0 none). */
function boundaries(
  u: Float32Array,
  v: Float32Array,
  t: Float32Array,
  td: Float32Array,
  grid: Parameters<typeof locator>[0],
  steep: Uint8Array,
) {
  const [w, h] = gridSize(grid);
  const dx = grid.kind === "lambert" ? grid.dx : 3000;
  const st = smooth(t, w, h, 4);
  const sd = smooth(td, w, h, 4);
  const div = new Float32Array(w * h);
  const gt = new Float32Array(w * h);
  const gd = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      div[k] =
        (u[k + 1] - u[k - 1]) / (2 * dx) + (v[k + w] - v[k - w]) / (2 * dx);
      // Gradients in K per 100 km.
      gt[k] =
        (Math.hypot(st[k + 1] - st[k - 1], st[k + w] - st[k - w]) / (2 * dx)) *
        1e5;
      gd[k] =
        (Math.hypot(sd[k + 1] - sd[k - 1], sd[k + w] - sd[k - w]) / (2 * dx)) *
        1e5;
    }
  const conv = smooth(div, w, h, 4);
  const loc = locator(grid);
  const out = new Uint8Array(LW * LH);
  for (let j = 0; j < LH; j++)
    for (let i = 0; i < LW; i++) {
      const [fi, fj] = loc(CONUS[3] - j * 0.1, CONUS[0] + i * 0.1);
      const x = Math.round(fi);
      const y = Math.round(fj);
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const k = y * w + x;
      // On mountain slopes temperature and moisture change with height, not across a front.
      if (steep[k] || !(conv[k] <= -4e-5)) continue;
      out[j * LW + i] = (gt[k] >= 4 ? TEMP : 0) | (gd[k] >= 6 ? MOIST : 0);
    }
  return out;
}

type Piece = {
  id: number;
  cells: number[];
  kind: number;
  lat: number;
  lon: number;
};

/** Connected stretches (8-neighbors) of at least `min` cells. */
function pieces(mask: Uint8Array, min = 5): Piece[] {
  const seen = new Int32Array(mask.length).fill(-1);
  const out: Piece[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s] >= 0) continue;
    const id = out.length;
    const cells: number[] = [];
    const stack = [s];
    seen[s] = id;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const ci = c % LW;
      const cj = (c - ci) / LW;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= LW || j >= LH) continue;
          const n = j * LW + i;
          if (mask[n] && seen[n] < 0) {
            seen[n] = id;
            stack.push(n);
          }
        }
    }
    if (cells.length < min) continue;
    let t = 0;
    let m = 0;
    let la = 0;
    let lo = 0;
    for (const c of cells) {
      if (mask[c] & TEMP) t++;
      if (mask[c] & MOIST) m++;
      la += CONUS[3] - Math.floor(c / LW) * 0.1;
      lo += CONUS[0] + (c % LW) * 0.1;
    }
    out.push({
      id,
      cells,
      kind:
        (t >= cells.length / 3 ? TEMP : 0) |
        (m >= cells.length / 3 ? MOIST : 0),
      lat: la / cells.length,
      lon: lo / cells.length,
    });
  }
  return out;
}

const cellLL = (c: number) => [
  CONUS[3] - Math.floor(c / LW) * 0.1,
  CONUS[0] + (c % LW) * 0.1,
];

/** The closest pair of cells between two stretches (sampled), and their distance (km). */
function nearest(a: Piece, b: Piece) {
  let best = { d: Infinity, a: a.cells[0], b: b.cells[0] };
  const sa = a.cells.filter((_, i) => i % Math.ceil(a.cells.length / 60) === 0);
  const sb = b.cells.filter((_, i) => i % Math.ceil(b.cells.length / 60) === 0);
  for (const x of sa) {
    const [la, lo] = cellLL(x);
    for (const y of sb) {
      const [lb, lob] = cellLL(y);
      const d = distKm(la, lo, lb, lob);
      if (d < best.d) best = { d, a: x, b: y };
    }
  }
  return best;
}

/** WPC's analyzed fronts and troughs, as point lists, from the coded surface bulletin. */
async function wpcFronts() {
  const r = await fetch("https://www.wpc.ncep.noaa.gov/discussions/codsus", {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const out: { kind: string; pts: [number, number][] }[] = [];
  for (const line of (await r.text()).split("\n")) {
    const [kind, ...rest] = line.trim().split(/\s+/);
    if (!["COLD", "WARM", "STNRY", "OCFNT", "TROF", "DRYLINE"].includes(kind))
      continue;
    out.push({
      kind,
      pts: rest
        .filter((x) => /^\d{4,5}$/.test(x))
        .map((x) => [Number(x.slice(0, 2)), -Number(x.slice(2))]),
    });
  }
  return out;
}
const FRONT: Record<string, string> = {
  COLD: "a cold front",
  WARM: "a warm front",
  STNRY: "a stationary front",
  OCFNT: "an occluded front",
  TROF: "a trough",
  DRYLINE: "a dryline",
};

type Ob = {
  lat: number;
  lon: number;
  tmpf: number | null;
  dwpf: number | null;
  sknt: number | null;
  drct: number | null;
  utc_valid: string | null;
};
async function airports(): Promise<Ob[]> {
  const r = await fetch(
    "https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&country=US",
    { cache: "no-store", signal: AbortSignal.timeout(25000) },
  ).catch(() => null);
  if (!r?.ok) return [];
  return ((await r.json()) as { data: Ob[] }).data.filter(
    (o) => o.utc_valid && Date.now() - Date.parse(o.utc_valid) < 90 * 60_000,
  );
}

/** What airports within 80 km say: converging winds, a dew-point or temperature split. */
function obsAt(obs: Ob[], lat: number, lon: number) {
  const near = obs.filter((o) => distKm(lat, lon, o.lat, o.lon) <= 80);
  const out: string[] = [];
  let conv = false;
  const winds = near.filter((o) => o.sknt != null && o.drct != null);
  if (winds.length >= 3) {
    // Least-squares fit of a linear wind field: u = a + b·x + c·y, v = d + e·x + f·y.
    const k = Math.cos((lat * Math.PI) / 180) * 111_320;
    const rows = winds.map((o) => {
      const s = (o.sknt as number) * 0.514;
      const r = ((o.drct as number) * Math.PI) / 180;
      return {
        x: (o.lon - lon) * k,
        y: (o.lat - lat) * 111_320,
        u: -s * Math.sin(r),
        v: -s * Math.cos(r),
      };
    });
    const fit = (val: (q: (typeof rows)[number]) => number) => {
      // Normal equations for [1, x, y].
      let [n, sx, sy, sxx, syy, sxy, sv, sxv, syv] = [
        0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      for (const q of rows) {
        const z = val(q);
        n++;
        sx += q.x;
        sy += q.y;
        sxx += q.x * q.x;
        syy += q.y * q.y;
        sxy += q.x * q.y;
        sv += z;
        sxv += q.x * z;
        syv += q.y * z;
      }
      const A = [
        [n, sx, sy],
        [sx, sxx, sxy],
        [sy, sxy, syy],
      ];
      const B = [sv, sxv, syv];
      const det = (M: number[][]) =>
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      const D = det(A);
      if (Math.abs(D) < 1e-6) return null;
      const col = (c: number) =>
        det(A.map((r, i) => r.map((x, j) => (j === c ? B[i] : x))));
      return [col(0) / D, col(1) / D, col(2) / D];
    };
    const fu = fit((q) => q.u);
    const fv = fit((q) => q.v);
    if (fu && fv && fu[1] + fv[2] < -2e-5) {
      conv = true;
      out.push(`airport winds converge (${winds.length} stations)`);
    }
  }
  const dew = near.map((o) => o.dwpf).filter((x): x is number => x != null);
  const tmp = near.map((o) => o.tmpf).filter((x): x is number => x != null);
  const dSplit = dew.length >= 3 ? Math.max(...dew) - Math.min(...dew) : 0;
  const tSplit = tmp.length >= 3 ? Math.max(...tmp) - Math.min(...tmp) : 0;
  if (dSplit >= 8)
    out.push(`dew points differ by ${Math.round(dSplit)}°F nearby`);
  if (tSplit >= 6)
    out.push(`temperatures differ by ${Math.round(tSplit)}°F nearby`);
  return { lines: out, conv, split: dSplit >= 8 || tSplit >= 6 };
}

export async function bound(cycle: string): Promise<Computed> {
  const base = Math.floor(Date.now() / 3600_000) * 3600_000;
  const t0 = cycleTime(cycle);
  const masks: Uint8Array[] = [];
  let grid: Parameters<typeof locator>[0] | null = null;
  // Terrain steeper than about 5 m per km (smoothed over ~25 km) is left out.
  const [zs] = await grab(cycle, hourFor(cycle, base), [":HGT:surface:"]);
  const steep = (() => {
    const [w, h] = gridSize(zs.grid);
    const dx = zs.grid.kind === "lambert" ? zs.grid.dx : 3000;
    const z = smooth(zs.values, w, h, 4);
    const out = new Uint8Array(w * h);
    for (let j = 1; j < h - 1; j++)
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        const slope =
          (Math.hypot(z[k + 1] - z[k - 1], z[k + w] - z[k - w]) / (2 * dx)) *
          1000;
        out[k] = slope > 5 ? 1 : 0;
      }
    return out;
  })();
  for (let h = 0; h <= 3; h++) {
    const fh = hourFor(cycle, base + h * 3600_000);
    const [u, v, t, td] = await grab(cycle, fh, [
      ":UGRD:10 m above ground:",
      ":VGRD:10 m above ground:",
      ":TMP:2 m above ground:",
      ":DPT:2 m above ground:",
    ]);
    grid = u.grid;
    masks.push(
      boundaries(u.values, v.values, t.values, td.values, u.grid, steep),
    );
  }
  const fhEnv = hourFor(cycle, base + 2 * 3600_000);
  const [[cape, cin, srh, us, vs], fronts, obs] = await Promise.all([
    grab(cycle, fhEnv, [
      ":CAPE:90-0 mb above ground:",
      ":CIN:90-0 mb above ground:",
      ":HLCY:1000-0 m above ground:",
      ":VUCSH:0-6000 m above ground:",
      ":VVCSH:0-6000 m above ground:",
    ]),
    wpcFronts(),
    airports(),
  ]);
  const loc = locator(grid!);
  const [gw] = gridSize(grid!);
  const env = (lat: number, lon: number) => {
    const [fi, fj] = loc(lat, lon);
    const k = Math.round(fj) * gw + Math.round(fi);
    return {
      cape: cape.values[k],
      cin: cin.values[k],
      srh: srh.values[k],
      shear: Math.hypot(us.values[k], vs.values[k]) * 1.944,
    };
  };
  const byHour = masks.map((m) => pieces(m, 8));
  // Only the stretches long enough to follow are drawn.
  masks.forEach((m, h) => {
    const keep = new Uint8Array(m.length);
    for (const p of byHour[h]) for (const c of p.cells) keep[c] = 1;
    for (let i = 0; i < m.length; i++) if (!keep[i]) m[i] = 0;
  });
  // Collisions: two stretches joining from one hour to the next, or a temperature and a
  // moisture stretch already touching.
  const raw: { lat: number; lon: number; h: number; kinds: string }[] = [];
  for (let h = 0; h <= 3; h++) {
    for (const p of byHour[h])
      if (p.kind === (TEMP | MOIST)) {
        const both = p.cells.filter((c) => masks[h][c] === (TEMP | MOIST));
        if (both.length >= 3) {
          const [la, lo] = cellLL(both[Math.floor(both.length / 2)]);
          raw.push({
            lat: la,
            lon: lo,
            h,
            kinds: "a temperature and a moisture boundary",
          });
        }
      }
    if (!h) continue;
    const prev = byHour[h - 1];
    const into = new Map<number, Piece[]>();
    for (const p of prev) {
      let best: { q: Piece; d: number } | null = null;
      for (const q of byHour[h]) {
        if (distKm(p.lat, p.lon, q.lat, q.lon) > 400) continue;
        const d = nearest(p, q).d;
        if (d <= 40 && (!best || d < best.d)) best = { q, d };
      }
      if (best) into.set(best.q.id, [...(into.get(best.q.id) ?? []), p]);
    }
    for (const parts of into.values())
      if (parts.length >= 2) {
        const [a, b] = parts.sort((x, y) => y.cells.length - x.cells.length);
        const n = nearest(a, b);
        const [la, lo] = cellLL(n.a);
        const [lb, lob] = cellLL(n.b);
        raw.push({
          lat: (la + lb) / 2,
          lon: (lo + lob) / 2,
          h: h - 0.5,
          kinds:
            a.kind === b.kind
              ? `two ${KIND[a.kind] || "wind-shift"} boundaries`
              : `a ${KIND[a.kind] || "wind-shift"} and a ${KIND[b.kind] || "wind-shift"} boundary`,
        });
      }
  }
  places ??= parsePlaces(PLACES);
  const rows = places;
  const found: Collision[] = [];
  for (const c of raw.sort((a, b) => a.h - b.h)) {
    if (found.some((f) => distKm(f.lat, f.lon, c.lat, c.lon) < 120)) continue;
    const near = nearestPlace(rows, c.lat, c.lon, 500);
    if (!near || near.miles > 60) continue;
    const e = env(c.lat, c.lon);
    const o = obsAt(obs, c.lat, c.lon);
    const wpc = fronts.find((f) =>
      f.pts.some(([la, lo]) => distKm(la, lo, c.lat, c.lon) <= 120),
    );
    // How sure the collision is (the model sees it; observations and WPC agree), times
    // whether there is fuel for storms there (no CAPE, little chance whatever meets).
    const fuel = Math.min(1, Math.max(0, e.cape / 1500));
    const capped = e.cin < -100 ? 0.3 : e.cin < -50 ? 0.7 : 1;
    const sure =
      0.5 + (o.conv ? 0.2 : 0) + (o.split ? 0.15 : 0) + (wpc ? 0.15 : 0);
    const score = Math.round(100 * sure * (0.2 + 0.8 * fuel * capped));
    const evidence = [
      `HRRR: ${c.kinds} meet${c.h <= 0 ? " now" : ""}`,
      ...o.lines,
      ...(wpc ? [`WPC analyzes ${FRONT[wpc.kind]} here`] : []),
      `${Math.round(e.cape).toLocaleString("en-US")} J/kg CAPE, CIN ${Math.round(e.cin)}, ${Math.round(e.srh)} m²/s² low-level spin, ${Math.round(e.shear)} kt shear`,
    ];
    found.push({
      lat: c.lat,
      lon: c.lon,
      place: `${near.miles < 5 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`,
      at: base + c.h * 3600_000,
      // Timing spreads with lead time: half an hour now, about 1.5 hours at +3.
      spread: Math.round(30 + 20 * Math.max(0, c.h)),
      kinds: c.kinds,
      score,
      evidence,
    });
  }
  found.sort((a, b) => b.score - a.score);
  const top = found.slice(0, 12);
  const asField = (m: Uint8Array) => {
    const v = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) v[i] = m[i];
    return v;
  };
  return {
    field: { grid: LATTICE, values: asField(masks[0]) },
    cycle,
    fh: hourFor(cycle, base),
    alt: {
      field: { grid: LATTICE, values: asField(masks[3]) },
      levels: [0.5, 1.5, 2.5],
    },
    note:
      t0 < base - 4 * 3600_000
        ? "The newest HRRR run is older than usual."
        : undefined,
    extra: { points: top },
    flags: () =>
      top
        .filter((c) => c.score >= 50)
        .map((c) => ({
          key: `${cycle}:${c.lat.toFixed(1)},${c.lon.toFixed(1)}`,
          at: c.at - 30 * 60_000,
          lat: c.lat,
          lon: c.lon,
          label: `${c.place} (${c.score})`,
          window_min: 150,
          radius_km: 40,
        })),
  };
}
