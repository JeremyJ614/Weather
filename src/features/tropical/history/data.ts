/**
 * The hurricane history globe's data (Tropical Outlook → History), built from NOAA NCEI's
 * IBTrACS by scripts/build-tracks.py: every tropical cyclone on record worldwide, its
 * 6-hourly track and its numbers. About 1 MB over the wire, fetched once when the tab opens
 * and kept for the session.
 */
export const BASINS = ["NA", "EP", "WP", "NI", "SI", "SP", "SA"] as const;
export const BASIN_NAME: Record<(typeof BASINS)[number], string> = {
  NA: "North Atlantic",
  EP: "East Pacific",
  WP: "West Pacific",
  NI: "North Indian",
  SI: "South Indian",
  SP: "South Pacific",
  SA: "South Atlantic",
};

export type Storms = {
  built: string;
  source: string;
  name: string[];
  y: number[];
  b: number[];
  t0: number[];
  t1: number[];
  o: number[];
  n: number[];
  w: number[];
  p: number[];
  a: number[];
  lf: number[];
  km: number[];
};

export type Tracks = {
  storms: Storms;
  count: number;
  /** Per point: degrees, hours since the storm began, wind (kt, 255 unknown). */
  lat: Float32Array;
  lon: Float32Array;
  hour: Uint16Array;
  wind: Uint8Array;
  /** Which storm each point belongs to. */
  storm: Uint32Array;
  land: Float32Array[];
};

/** Undoes build-tracks.py's packing: absolute first point per storm, steps after it. */
export function decodePoints(buf: ArrayBuffer, offsets: number[], n: number) {
  const dlat = new Int16Array(buf, 0, n);
  const dlon = new Int16Array(buf, 2 * n, n);
  const dhr = new Uint16Array(buf, 4 * n, n);
  const wind = new Uint8Array(buf, 6 * n, n).slice();
  const lat = new Float32Array(n);
  const lon = new Float32Array(n);
  const hour = new Uint16Array(n);
  const storm = new Uint32Array(n);
  const starts = new Set(offsets);
  let s = -1;
  let la = 0;
  let lo = 0;
  let hr = 0;
  for (let i = 0; i < n; i++) {
    if (starts.has(i)) {
      s++;
      la = dlat[i];
      lo = dlon[i];
      hr = dhr[i];
    } else {
      la += dlat[i];
      lo = ((lo + dlon[i] + 18000 + 36000) % 36000) - 18000;
      hr = (hr + dhr[i]) & 0xffff;
    }
    lat[i] = la / 100;
    lon[i] = lo / 100;
    hour[i] = hr;
    storm[i] = s;
  }
  return { lat, lon, hour, wind, storm };
}

/** Land rings: a count, each ring's length, then lon/lat pairs ×100. */
export function decodeLand(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const rings = v.getUint32(0, true);
  const lens = new Uint32Array(buf.slice(4, 4 + rings * 4));
  const out: Float32Array[] = [];
  let at = 4 + rings * 4;
  for (const len of lens) {
    const r = new Float32Array(len * 2);
    for (let k = 0; k < len * 2; k++) r[k] = v.getInt16(at + k * 2, true) / 100;
    at += len * 4;
    out.push(r);
  }
  return out;
}

async function gunzip(url: string) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`${url} ${r.status}`);
  return new Response(
    r.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
}

let memo: Promise<Tracks> | null = null;

/** Every track, fetched once a session. */
export function loadTracks(): Promise<Tracks> {
  memo ??= (async () => {
    const [meta, pts, land] = await Promise.all([
      fetch("/extras/tracks/storms.json").then((r) => {
        if (!r.ok) throw new Error(`storms ${r.status}`);
        return r.json() as Promise<{
          built: string;
          source: string;
          points: number;
          s: Omit<Storms, "built" | "source">;
        }>;
      }),
      gunzip("/extras/tracks/points.bin.gz"),
      gunzip("/extras/tracks/land.bin.gz"),
    ]);
    const storms = { ...meta.s, built: meta.built, source: meta.source };
    return {
      storms,
      count: storms.y.length,
      ...decodePoints(pts, storms.o, meta.points),
      land: decodeLand(land),
    };
  })();
  memo.catch(() => {
    memo = null;
  });
  return memo;
}

/** Saffir-Simpson tier index (0 depression … 6 Category 5) from wind in knots. */
export const tierIndex = (kt: number) =>
  kt >= 137
    ? 6
    : kt >= 113
      ? 5
      : kt >= 96
        ? 4
        : kt >= 83
          ? 3
          : kt >= 64
            ? 2
            : kt >= 34
              ? 1
              : 0;

/** Great-circle distance (km). */
export function km(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180;
  const x =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, x)));
}

/** Storms whose track passed within `radiusKm` of a place. */
export function stormsNear(
  t: Tracks,
  lat: number,
  lon: number,
  radiusKm: number,
) {
  const hit = new Set<number>();
  const dLat = radiusKm / 111 + 0.5;
  for (let i = 0; i < t.lat.length; i++) {
    if (Math.abs(t.lat[i] - lat) > dLat) continue;
    if (hit.has(t.storm[i])) continue;
    if (km(lat, lon, t.lat[i], t.lon[i]) <= radiusKm) hit.add(t.storm[i]);
  }
  return hit;
}

/** A storm's headline numbers for the info card. */
export function stormFacts(t: Tracks, i: number) {
  const s = t.storms;
  const o = s.o[i];
  const n = s.n[i];
  let peakAt = o;
  let maxLat = 0;
  for (let k = o; k < o + n; k++) {
    if (
      t.wind[k] !== 255 &&
      (t.wind[peakAt] === 255 || t.wind[k] > t.wind[peakAt])
    )
      peakAt = k;
    if (Math.abs(t.lat[k]) > Math.abs(maxLat)) maxLat = t.lat[k];
  }
  return {
    name: s.name[i] || "Unnamed",
    season: s.y[i],
    basin: BASINS[s.b[i]],
    start: s.t0[i] * 3600_000,
    end: s.t1[i] * 3600_000,
    days: Math.round(((s.t1[i] - s.t0[i]) / 24) * 10) / 10,
    kt: s.w[i],
    hpa: s.p[i] || null,
    ace: s.a[i] / 10,
    landfalls: s.lf[i],
    miles: Math.round(s.km[i] / 1.609),
    tier: tierIndex(s.w[i]),
    peak: { lat: t.lat[peakAt], lon: t.lon[peakAt] },
    maxLat,
  };
}

export type Filter = {
  from: number;
  to: number;
  /** Basin indexes shown (all when empty). */
  basins: number[];
  /** Lowest Saffir-Simpson tier shown (0 everything). */
  minTier: number;
  /** Only these storms (near your place), when set. */
  only?: Set<number> | null;
  /** Name search, case-insensitive prefix. */
  query?: string;
};

/** One flag per storm: shown under the filter or not. */
export function keptBy(t: Tracks, f: Filter) {
  const s = t.storms;
  const out = new Uint8Array(t.count);
  const q = f.query?.trim().toLowerCase() ?? "";
  for (let i = 0; i < t.count; i++) {
    if (s.y[i] < f.from || s.y[i] > f.to) continue;
    if (f.basins.length && !f.basins.includes(s.b[i])) continue;
    if (tierIndex(s.w[i]) < f.minTier) continue;
    if (f.only && !f.only.has(i)) continue;
    if (q && !s.name[i].toLowerCase().startsWith(q)) continue;
    out[i] = 1;
  }
  return out;
}

/** The shown storms' totals, and the record holders among them. */
export function summary(t: Tracks, kept: Uint8Array) {
  const s = t.storms;
  let storms = 0;
  let hurricanes = 0;
  let majors = 0;
  let ace = 0;
  const best = { hpa: -1, kt: -1, days: -1, km: -1, ace: -1, falls: -1 };
  const better = (
    k: keyof typeof best,
    i: number,
    v: number,
    lower = false,
  ) => {
    const j = best[k];
    if (j < 0) return (best[k] = i);
    const cur =
      k === "hpa"
        ? s.p[j]
        : k === "kt"
          ? s.w[j]
          : k === "days"
            ? s.t1[j] - s.t0[j]
            : k === "km"
              ? s.km[j]
              : k === "ace"
                ? s.a[j]
                : s.lf[j];
    if (lower ? v < cur : v > cur) best[k] = i;
  };
  for (let i = 0; i < t.count; i++) {
    if (!kept[i]) continue;
    storms++;
    if (s.w[i] >= 64) hurricanes++;
    if (s.w[i] >= 96) majors++;
    ace += s.a[i] / 10;
    if (s.p[i]) better("hpa", i, s.p[i], true);
    better("kt", i, s.w[i]);
    better("days", i, s.t1[i] - s.t0[i]);
    better("km", i, s.km[i]);
    better("ace", i, s.a[i]);
    better("falls", i, s.lf[i]);
  }
  return { storms, hurricanes, majors, ace: Math.round(ace), best };
}

/**
 * Famous storms named on the globe while they play (IBTrACS names most storms since the 1950s;
 * older ones are found by season, basin and a point on their track).
 */
export const FAMOUS: {
  label: string;
  y: number;
  name?: string;
  at?: [number, number];
}[] = [
  { label: "Galveston hurricane", y: 1900, at: [29.3, -94.8] },
  { label: "Great Miami hurricane", y: 1926, at: [25.8, -80.2] },
  { label: "Okeechobee hurricane", y: 1928, at: [26.7, -80.4] },
  { label: "Labor Day hurricane", y: 1935, at: [24.8, -80.8] },
  { label: "New England hurricane", y: 1938, at: [41.2, -72.6] },
  { label: "Camille", y: 1969, name: "Camille" },
  { label: "Bhola cyclone", y: 1970, at: [21.8, 90.5] },
  { label: "Tracy", y: 1975, name: "Tracy" },
  { label: "Tip", y: 1979, name: "Tip" },
  { label: "Gilbert", y: 1988, name: "Gilbert" },
  { label: "Andrew", y: 1992, name: "Andrew" },
  { label: "Mitch", y: 1998, name: "Mitch" },
  { label: "Katrina", y: 2005, name: "Katrina" },
  { label: "Nargis", y: 2008, name: "Nargis" },
  { label: "Haiyan", y: 2013, name: "Haiyan" },
  { label: "Patricia", y: 2015, name: "Patricia" },
  { label: "Maria", y: 2017, name: "Maria" },
  { label: "Idai", y: 2019, name: "Idai" },
  { label: "Dorian", y: 2019, name: "Dorian" },
  { label: "Ian", y: 2022, name: "Ian" },
  { label: "Freddy", y: 2023, name: "Freddy" },
  { label: "Otis", y: 2023, name: "Otis" },
  { label: "Helene", y: 2024, name: "Helene" },
  { label: "Milton", y: 2024, name: "Milton" },
  { label: "Melissa", y: 2025, name: "Melissa" },
];

/** Each famous storm's index in the archive (missing ones are skipped). */
export function famousIn(t: Tracks) {
  const s = t.storms;
  const out: { i: number; label: string }[] = [];
  for (const f of FAMOUS) {
    let found = -1;
    let bestD = 3;
    for (let i = 0; i < t.count; i++) {
      if (s.y[i] !== f.y) continue;
      if (f.name) {
        if (
          s.name[i].toLowerCase() === f.name.toLowerCase() &&
          (found < 0 || s.w[i] > s.w[found])
        )
          found = i;
        continue;
      }
      for (let k = s.o[i]; k < s.o[i] + s.n[i]; k++) {
        const d = Math.hypot(t.lat[k] - f.at![0], t.lon[k] - f.at![1]);
        if (d < bestD) {
          bestD = d;
          found = i;
        }
      }
    }
    if (found >= 0) out.push({ i: found, label: f.label });
  }
  return out;
}
