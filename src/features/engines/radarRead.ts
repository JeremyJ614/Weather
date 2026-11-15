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
  return { vrot, km: cKm, debris };
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

/** Reads the nearest radar for one storm. Null when no radar has a recent scan of it. */
export async function readStorm(
  s: StormAt,
  signal?: AbortSignal,
): Promise<RadarRead | null> {
  for (const site of nearestSites(s.lat, s.lon, 2)) {
    if (site.km > 230) break;
    const vols = await recentVolumes(site.id, signal);
    const vol = vols.at(-1);
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
    return {
      site: site.id,
      age: Math.round((Date.now() - vel.end) / 60_000),
      beamFt: beamFt(c.km || p.km, vel.angle),
      miles: Math.round((c.km || p.km) / 1.609),
      vrot: c.vrot,
      debris: c.debris,
    };
  }
  return null;
}
