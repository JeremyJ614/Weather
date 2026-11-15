/**
 * ProbTor's radar check (post-launch A6 "real velocity rotation" and "debris check"), run in the
 * browser so it costs the server nothing: the nearest WSR-88D's newest lowest scan from the
 * public Level II archive, read with the same decoder as the Tornado Archive, then
 *
 *   - the strongest cyclonic couplet near the storm (inbound with outbound clockwise of it,
 *     within 7 km): rotational velocity, Vrot = (outbound - inbound) / 2;
 *   - a tornado debris signature at it: 4+ gates within 2.5 km with reflectivity 30 dBZ+ and
 *     correlation coefficient 0.85 or less.
 */
import type { RadarRead } from "@/lib/engines/project";
import { readLowestScan } from "@/features/replay/radar/level2/scan";
import { nearestSites } from "@/features/replay/radar/level2/sites";
import {
  BUCKET,
  dayPrefix,
  parseListing,
  volumeFromKey,
  type VolumeRef,
} from "@/features/replay/radar/level2/volumes";
import { valueOf, type Sweep } from "@/features/replay/radar/level2/sweep";

const R = Math.PI / 180;
const KE = 8494; // 4/3 earth radius, km
const MS_KT = 1.943844;

export type StormAt = {
  lat: number;
  lon: number;
  /** Storm motion (m/s east, north), area (km²) and when ProbSevere placed it. */
  east: number;
  north: number;
  size: number;
  at: number;
};

/** Range (km) and azimuth (degrees) from a site to a point, on a local flat earth. */
export function polar(
  site: { lat: number; lon: number },
  lat: number,
  lon: number,
) {
  const x = (lon - site.lon) * 111.32 * Math.cos(site.lat * R);
  const y = (lat - site.lat) * 111.32;
  return { km: Math.hypot(x, y), az: (Math.atan2(x, y) / R + 360) % 360 };
}

/** Beam center height (ft) above the radar at a range, 4/3-earth refraction. */
export function beamFt(km: number, deg: number) {
  const h = Math.sqrt(km * km + KE * KE + 2 * km * KE * Math.sin(deg * R)) - KE;
  return Math.round((h * 3280.84) / 100) * 100;
}

function at(s: Sweep, row: number, gate: number) {
  const r = ((row % s.rows) + s.rows) % s.rows;
  if (gate < 0 || gate >= s.gates) return null;
  return valueOf(s, s.data[r * s.gates + gate]);
}
const rowOf = (s: Sweep, az: number) =>
  Math.floor((((az % 360) + 360) % 360) / (360 / s.rows));
const gateOf = (s: Sweep, km: number) =>
  Math.round((km * 1000 - s.first) / s.spacing);

/**
 * The strongest cyclonic couplet within `half` km of a point (range `km`, azimuth `az`), and
 * whether a debris signature sits on it. Pure: the tests feed it made-up sweeps.
 */
export function couplet(
  vel: Sweep,
  km: number,
  az: number,
  half: number,
  ref?: Sweep,
  rho?: Sweep,
) {
  const step = (360 / vel.rows) * R;
  const g0 = gateOf(vel, km - half);
  const g1 = gateOf(vel, km + half);
  const dRow = Math.ceil(half / Math.max(1, km) / step);
  const r0 = rowOf(vel, az);
  // Background flow for unfolding: the median velocity in the window.
  const all: number[] = [];
  for (let i = -dRow; i <= dRow; i++)
    for (let g = g0; g <= g1; g += 4) {
      const v = at(vel, r0 + i, g);
      if (v !== null) all.push(v);
    }
  all.sort((a, b) => a - b);
  const m = all[all.length >> 1] ?? 0;
  const nyq = vel.nyquist;
  const unfold = (v: number | null) => {
    if (v === null || !nyq || Math.abs(m) < 0.5 * nyq) return v;
    // Strong background flow folds: take the candidate nearest it.
    let best = v;
    for (const c of [v - 2 * nyq, v + 2 * nyq])
      if (Math.abs(c - m) < Math.abs(best - m)) best = c;
    return best;
  };
  const V = (i: number, g: number) => unfold(at(vel, i, g));
  // A gate counts only with a neighbor the same sign at half its speed or more (no speckle).
  const backed = (i: number, g: number, v: number) =>
    [V(i - 1, g), V(i + 1, g), V(i, g - 1), V(i, g + 1)].some(
      (n) =>
        n !== null &&
        Math.sign(n) === Math.sign(v) &&
        Math.abs(n) >= Math.abs(v) / 2,
    );
  let best = { dv: 0, row: r0, gate: gateOf(vel, km) };
  for (let i = -dRow; i <= dRow; i++)
    for (let g = g0; g <= g1; g++) {
      const vin = V(r0 + i, g);
      if (vin === null || vin > -5 || !backed(r0 + i, g, vin)) continue;
      const rangeKm = (vel.first + g * vel.spacing) / 1000;
      const k = Math.min(24, Math.ceil(7 / Math.max(1, rangeKm) / step));
      for (let d = 1; d <= k; d++)
        for (let dg = -2; dg <= 2; dg++) {
          const vout = V(r0 + i + d, g + dg);
          if (vout === null || vout < 5) continue;
          const dv = vout - vin;
          if (dv > best.dv && backed(r0 + i + d, g + dg, vout))
            best = { dv, row: r0 + i + (d >> 1), gate: g + (dg >> 1) };
        }
    }
  const vrot = Math.round((best.dv / 2) * MS_KT);
  const cKm = (vel.first + best.gate * vel.spacing) / 1000;
  const cAz = (best.row + 0.5) * (360 / vel.rows);
  let debris = false;
  if (ref && rho && vrot >= 20) {
    let n = 0;
    const rr = rowOf(ref, cAz);
    const rs = (360 / ref.rows) * R;
    const dr = Math.ceil(2.5 / Math.max(1, cKm) / rs);
    const gc = gateOf(ref, cKm);
    const dgc = Math.ceil(2500 / ref.spacing);
    for (let i = -dr; i <= dr; i++)
      for (let g = gc - dgc; g <= gc + dgc; g++) {
        const z = at(ref, rr + i, g);
        const kmG = (ref.first + g * ref.spacing) / 1000;
        const c = at(rho, rowOf(rho, cAz + (i * rs) / R), gateOf(rho, kmG));
        if (z !== null && z >= 30 && c !== null && c > 0.2 && c <= 0.85) n++;
      }
    debris = n >= 4;
  }
  return { vrot, km: cKm, az: cAz, debris };
}

/** The volumes a site wrote in the last half hour, newest last. */
async function recentVolumes(site: string, signal?: AbortSignal) {
  const now = Date.now() / 1000;
  const from = now - 1800;
  const prefixes = [...new Set([dayPrefix(site, from), dayPrefix(site, now)])];
  const out: VolumeRef[] = [];
  for (const prefix of prefixes) {
    const d = new Date(from * 1000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    const q = new URLSearchParams({ "list-type": "2", prefix });
    q.set(
      "start-after",
      `${prefix}${site}${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}_${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00`,
    );
    const res = await fetch(`${BUCKET}/?${q}`, { signal });
    if (!res.ok) continue;
    for (const k of parseListing(await res.text()).keys) {
      const v = volumeFromKey(k);
      if (v && v.time >= from) out.push(v);
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** The nearest radar's newest lowest scan of a storm (within 230 km), with the storm moved to the scan's time. */
async function stormScan(s: StormAt, signal?: AbortSignal) {
  for (const site of nearestSites(s.lat, s.lon, 2)) {
    if (site.km > 230) break;
    const vol = (await recentVolumes(site.id, signal)).at(-1);
    if (!vol) continue;
    const scan = await readLowestScan(vol, { signal });
    const vel = scan.sweeps.VEL;
    if (!vel) continue;
    // Move the storm to the moment of the scan along its own motion.
    const dt = ((vel.start + vel.end) / 2 - s.at) / 1000;
    const lat = s.lat + (s.north * dt) / 111_320;
    const lon = s.lon + (s.east * dt) / (111_320 * Math.cos(s.lat * R));
    const p = polar(scan, lat, lon);
    const half = Math.max(
      6,
      Math.min(18, Math.sqrt((s.size || 100) / Math.PI) + 4),
    );
    const c = couplet(vel, p.km, p.az, half, scan.sweeps.REF, scan.sweeps.RHO);
    return { site: site.id, scan, vel, p, c };
  }
  return null;
}

/** Reads the nearest radar for one storm. Null when no radar has a recent scan of it. */
export async function readStorm(
  s: StormAt,
  signal?: AbortSignal,
): Promise<RadarRead | null> {
  const x = await stormScan(s, signal);
  if (!x) return null;
  const { site, vel, p, c } = x;
  return {
    site,
    age: Math.round((Date.now() - vel.end) / 60_000),
    beamFt: beamFt(c.km || p.km, vel.angle),
    miles: Math.round((c.km || p.km) / 1.609),
    vrot: c.vrot,
    debris: c.debris,
  };
}

/**
 * How many of 16 sides of a point (radar range `km`, azimuth `az`) have heavy rain 2–8 km out
 * on the lowest scan: a mean of 35 dBZ or more in that sector. A classic supercell's hook
 * leaves its inflow side clear; a rain-wrapped one is wet nearly all the way round. Pure.
 */
export function wrapAround(ref: Sweep, km: number, az: number) {
  const cx = km * Math.sin(az * R);
  const cy = km * Math.cos(az * R);
  let wet = 0;
  for (let k = 0; k < 16; k++) {
    let sum = 0;
    let n = 0;
    for (let d = -10; d <= 10; d += 5)
      for (let r = 2; r <= 8; r += 0.5) {
        const t = (k * 22.5 + d) * R;
        const x = cx + r * Math.sin(t);
        const y = cy + r * Math.cos(t);
        const v = at(
          ref,
          rowOf(ref, (Math.atan2(x, y) / R + 360) % 360),
          gateOf(ref, Math.hypot(x, y)),
        );
        sum += v ?? 0;
        n++;
      }
    if (sum / n >= 35) wet++;
  }
  return wet;
}

export type WrapRead = RadarRead & {
  /** Sides of 16 around the rotation with heavy rain, and that as 0–100. */
  sides: number;
  seen: number;
};

/** Rain-Wrap's radar read: the rain around the storm's rotation (or its center without one). */
export async function readWrap(
  s: StormAt,
  signal?: AbortSignal,
): Promise<WrapRead | null> {
  const x = await stormScan(s, signal);
  const ref = x?.scan.sweeps.REF;
  if (!x || !ref) return null;
  const { site, vel, p, c } = x;
  const spot = c.vrot >= 15 ? { km: c.km, az: c.az } : p;
  const sides = wrapAround(ref, spot.km, spot.az);
  return {
    site,
    age: Math.round((Date.now() - vel.end) / 60_000),
    beamFt: beamFt(spot.km, vel.angle),
    miles: Math.round(spot.km / 1.609),
    vrot: c.vrot,
    debris: c.debris,
    sides,
    seen: Math.round((sides / 16) * 100),
  };
}

/** Box mean of a square grid (radius r cells), with an integral image. */
function boxMean(v: Float32Array, n: number, r: number) {
  const sum = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      sum[(j + 1) * (n + 1) + i + 1] =
        v[j * n + i] +
        sum[j * (n + 1) + i + 1] +
        sum[(j + 1) * (n + 1) + i] -
        sum[j * (n + 1) + i];
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - r),
        i1 = Math.min(n, i + r + 1);
      const j0 = Math.max(0, j - r),
        j1 = Math.min(n, j + r + 1);
      out[j * n + i] =
        (sum[j1 * (n + 1) + i1] -
          sum[j0 * (n + 1) + i1] -
          sum[j1 * (n + 1) + i0] +
          sum[j0 * (n + 1) + i0]) /
        ((i1 - i0) * (j1 - j0));
    }
  return out;
}

const AXES = [
  "N–S",
  "NNE–SSW",
  "NE–SW",
  "ENE–WSW",
  "E–W",
  "ESE–WNW",
  "SE–NW",
  "SSE–NNW",
];

export type FineLine = { km: number; long: number; axis: string };

/**
 * Fine lines on a radar's lowest reflectivity scan near a point (post-launch A6, Boundary
 * Collisions): the thin bands of weak echo (5–28 dBZ, insects and dust swept up by converging
 * air) that outflow boundaries, fronts and drylines draw in clear air. On a 1 km grid 120 km
 * across, a fine-line cell stands 4 dB or more above its 15 km surroundings with almost no rain
 * there; 8-connected stretches 25 km or longer and at least 4:1 count. Only cells within
 * 110 km of the radar are used, where the beam is still low enough to see them. Pure.
 */
export function fineLines(
  ref: Sweep,
  site: { lat: number; lon: number },
  lat: number,
  lon: number,
): FineLine[] {
  const N = 120;
  const z = new Float32Array(N * N).fill(-10);
  const ok = new Uint8Array(N * N);
  const kx = 111.32 * Math.cos(lat * R);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const la = lat + (N / 2 - j) / 111.32;
      const lo = lon + (i - N / 2) / kx;
      const p = polar(site, la, lo);
      if (p.km > 110 || p.km < 8) continue;
      ok[j * N + i] = 1;
      const v = at(ref, rowOf(ref, p.az), gateOf(ref, p.km));
      if (v !== null) z[j * N + i] = v;
    }
  const mean = boxMean(z, N, 7);
  const rain = new Float32Array(N * N);
  for (let k = 0; k < z.length; k++) rain[k] = z[k] >= 30 ? 1 : 0;
  const wet = boxMean(rain, N, 7);
  const mask = new Uint8Array(N * N);
  for (let k = 0; k < z.length; k++)
    if (ok[k] && z[k] >= 5 && z[k] <= 28 && z[k] - mean[k] >= 4 && wet[k] < 0.1)
      mask[k] = 1;
  const seen = new Uint8Array(N * N);
  const out: FineLine[] = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    const cells: number[] = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const ci = c % N,
        cj = (c - ci) / N;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ci + di,
            j = cj + dj;
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          const q = j * N + i;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
    }
    if (cells.length < 20) continue;
    let mx = 0,
      my = 0;
    for (const c of cells) {
      mx += c % N;
      my += Math.floor(c / N);
    }
    mx /= cells.length;
    my /= cells.length;
    let sxx = 0,
      syy = 0,
      sxy = 0,
      near = Infinity;
    for (const c of cells) {
      const x = (c % N) - mx;
      const y = my - Math.floor(c / N);
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      near = Math.min(
        near,
        Math.hypot((c % N) - N / 2, Math.floor(c / N) - N / 2),
      );
    }
    sxx /= cells.length;
    syy /= cells.length;
    sxy /= cells.length;
    const tr = sxx + syy;
    const l1 =
      tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - (sxx * syy - sxy * sxy)));
    const l2 = Math.max(0.05, tr - l1);
    const long = 4 * Math.sqrt(l1);
    if (long < 25 || l1 / l2 < 16) continue;
    // Bearing of the axis (east of north), folded into 0–180°.
    const ang =
      Math.abs(sxy) < 1e-9
        ? sxx >= syy
          ? 0
          : 90
        : Math.atan2(sxy, l1 - syy) / R;
    const deg = (((90 - ang) % 180) + 180) % 180;
    out.push({
      km: Math.round(near),
      long: Math.round(long),
      axis: AXES[Math.round(deg / 22.5) % 8],
    });
  }
  return out.sort((a, b) => a.km - b.km);
}

/** Fine lines near a collision from the nearest radar within 110 km, or null if none is that close. */
export async function readFineLines(
  lat: number,
  lon: number,
  signal?: AbortSignal,
) {
  const site = nearestSites(lat, lon, 1)[0];
  if (!site || site.km > 110) return null;
  const vols = await recentVolumes(site.id, signal);
  const vol = vols.at(-1);
  if (!vol) return null;
  const scan = await readLowestScan(vol, { signal });
  const ref = scan.sweeps.REF;
  if (!ref) return null;
  return {
    site: site.id,
    age: Math.round((Date.now() - ref.end) / 60_000),
    lines: fineLines(ref, scan, lat, lon).filter((l) => l.km <= 40),
  };
}
