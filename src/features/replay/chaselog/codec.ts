import type { ChasePayload, TornadoInput } from "../core/chase";
import type { Fix } from "../import/types";

/**
 * How a chase is stored (Fix-It #7.19): the track thinned to at most MAX_FIXES by time-aware
 * Douglas–Peucker (a point goes only if the car's interpolated position at that moment stays
 * within tolerance), then written as a polyline-style string of [seconds, lat, lon] deltas.
 * Tornadoes are kept with lightly thinned paths; damage, contours, hail and warnings are not
 * stored and are read back from NOAA and IEM when the chase is opened.
 */
export const MAX_FIXES = 1500;
const MAX_PATH = 150;

export type StoredChase = {
  v: 1;
  title: string;
  tz: string;
  T0: number;
  /** Encoded [dt, lat, lon] fixes, dt in seconds from T0. */
  track: string;
  torn: TornadoInput[];
};

/** Synchronized distance (degrees, lon scaled) of b from the a→c line at b's time. */
function sed(a: Fix, b: Fix, c: Fix, k: number) {
  const f = c[0] === a[0] ? 0 : (b[0] - a[0]) / (c[0] - a[0]);
  const lat = a[1] + f * (c[1] - a[1]);
  const lon = a[2] + f * (c[2] - a[2]);
  return Math.hypot(b[1] - lat, (b[2] - lon) * k);
}

function dp(fixes: Fix[], eps: number): Fix[] {
  const n = fixes.length;
  if (n <= 2) return fixes;
  const k = Math.cos((fixes[0][1] * Math.PI) / 180);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let m = i + 1; m < j; m++) {
      const d = sed(fixes[i], fixes[m], fixes[j], k);
      if (d > worst) {
        worst = d;
        at = m;
      }
    }
    if (worst > eps && at > 0) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return fixes.filter((_, i) => keep[i]);
}

/** Thins a track to at most `max` fixes, starting at ~5 m and loosening until it fits. */
export function simplify(fixes: Fix[], max = MAX_FIXES): Fix[] {
  let eps = 0.00005;
  let out = dp(fixes, eps);
  while (out.length > max) {
    eps *= 1.6;
    out = dp(fixes, eps);
  }
  return out;
}

function put(n: number, out: string[]) {
  let v = n < 0 ? ~(n << 1) : n << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function encodeTrack(fixes: Fix[], T0: number): string {
  const out: string[] = [];
  let pt = 0;
  let pa = 0;
  let po = 0;
  for (const [t, lat, lon] of fixes) {
    const ti = Math.round(t - T0);
    const la = Math.round(lat * 1e5);
    const lo = Math.round(lon * 1e5);
    put(ti - pt, out);
    put(la - pa, out);
    put(lo - po, out);
    pt = ti;
    pa = la;
    po = lo;
  }
  return out.join("");
}

export function decodeTrack(s: string): [number, number, number][] {
  const vals: number[] = [];
  let i = 0;
  while (i < s.length) {
    let shift = 0;
    let v = 0;
    let b: number;
    do {
      b = s.charCodeAt(i++) - 63;
      v |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    vals.push(v & 1 ? ~(v >> 1) : v >> 1);
  }
  const out: [number, number, number][] = [];
  let t = 0;
  let la = 0;
  let lo = 0;
  for (let j = 0; j + 2 < vals.length; j += 3) {
    t += vals[j];
    la += vals[j + 1];
    lo += vals[j + 2];
    out.push([t, la / 1e5, lo / 1e5]);
  }
  return out;
}

const thin = (coords: [number, number][]) => {
  const step = Math.max(1, Math.ceil(coords.length / MAX_PATH));
  return coords
    .filter((_, i) => i % step === 0 || i === coords.length - 1)
    .map(
      ([x, y]) =>
        [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5] as [
          number,
          number,
        ],
    );
};

export function packChase(
  title: string,
  tz: string,
  fixes: Fix[],
  torn: TornadoInput[],
): StoredChase {
  const T0 = fixes[0][0];
  return {
    v: 1,
    title,
    tz,
    T0,
    track: encodeTrack(simplify(fixes), T0),
    torn: torn.map((t) => ({
      ...t,
      coords: thin(t.coords),
      ...(t.comments ? { comments: t.comments.slice(0, 1500) } : {}),
    })),
  };
}

export function unpackChase(s: StoredChase): ChasePayload {
  return {
    title: s.title,
    tz: s.tz,
    T0: s.T0,
    track: decodeTrack(s.track),
    torn: s.torn,
  };
}
