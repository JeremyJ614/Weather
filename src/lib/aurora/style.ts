/** Aurora colors; editable in admin → Map & data colors (`aurora:*`). */
export const AURORA_RAMP = [
  { key: "p5", at: 5, label: "5% chance overhead", color: "#16a34a" },
  { key: "p20", at: 20, label: "20%", color: "#4ade80" },
  { key: "p40", at: 40, label: "40%", color: "#facc15" },
  { key: "p60", at: 60, label: "60%", color: "#f97316" },
  { key: "p80", at: 80, label: "80%+", color: "#ef4444" },
] as const;
export const AURORA_LINES = [
  { key: "edge", label: "Oval edge (10%)", color: "#4ade80" },
  { key: "view", label: "View line", color: "#f472b6" },
] as const;

/** NOAA G-scale by Kp, with what each step means from the Lower 48 (ported from VIP). */
export const KP_SCALE = [
  {
    key: "g0",
    min: 0,
    g: "G0",
    label: "Quiet",
    color: "#a78bfa",
    desc: "Polar regions. Nothing to see from the Lower 48.",
  },
  {
    key: "g0a",
    min: 4,
    g: "G0",
    label: "Active",
    color: "#c084fc",
    desc: "The auroral zone: northern Minnesota on a good night.",
  },
  {
    key: "g1",
    min: 5,
    g: "G1",
    label: "Minor storm",
    color: "#e879f9",
    desc: "Reaches about 50°N. Worth watching across the northern tier.",
  },
  {
    key: "g2",
    min: 6,
    g: "G2",
    label: "Moderate storm",
    color: "#d946ef",
    desc: "About 47°N, and photographable far south of that.",
  },
  {
    key: "g3",
    min: 7,
    g: "G3",
    label: "Strong storm",
    color: "#f472b6",
    desc: "About 43°N: Chicago, Boston, Portland.",
  },
  {
    key: "g4",
    min: 8,
    g: "G4",
    label: "Severe storm",
    color: "#fb7185",
    desc: "Mid-latitudes. A few nights a solar cycle.",
  },
  {
    key: "g5",
    min: 9,
    g: "G5",
    label: "Extreme storm",
    color: "#ef4444",
    desc: "Seen to the Gulf Coast in the great storms.",
  },
] as const;
export const kpBand = (kp: number) =>
  [...KP_SCALE].reverse().find((b) => kp >= b.min) ?? KP_SCALE[0];

/** Naked-eye view-line latitude by Kp (VIP's table, from SWPC's Kp maps). */
const KP_VIEW: [number, number][] = [
  [0, 66],
  [1, 63],
  [2, 60],
  [3, 56],
  [4, 53],
  [5, 50],
  [6, 47],
  [7, 43],
  [8, 40],
  [9, 37],
];
export function viewLineLat(kp: number) {
  const k = Math.max(0, Math.min(9, kp));
  for (let i = 0; i < KP_VIEW.length - 1; i++) {
    const [k0, l0] = KP_VIEW[i];
    const [k1, l1] = KP_VIEW[i + 1];
    if (k <= k1) return l0 + ((l1 - l0) * (k - k0)) / (k1 - k0);
  }
  return 37;
}
/** The Kp an aurora needs to reach a latitude, or null south of 37°. */
export function kpNeeded(lat: number) {
  // Integer tenths: summing 0.1 drifts (4.999… reads as 5.1 at exactly 50°N).
  for (let t = 0; t <= 90; t++)
    if (viewLineLat(t / 10) <= Math.abs(lat) + 1e-9) return t / 10;
  return null;
}

/** Geomagnetic north pole (IGRF dipole, 2025). */
const POLE = { lat: 80.8, lon: -72.7 };
const RAD = Math.PI / 180;

/** Dipole geomagnetic latitude of a point, in degrees. */
export function gmLat(lat: number, lon: number) {
  const s =
    Math.sin(lat * RAD) * Math.sin(POLE.lat * RAD) +
    Math.cos(lat * RAD) *
      Math.cos(POLE.lat * RAD) *
      Math.cos((lon - POLE.lon) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, s))) / RAD;
}

/** The geographic latitude along a meridian that sits at a given geomagnetic latitude. */
function latAtGm(gm: number, lon: number) {
  let lo = 0;
  let hi = 89.9;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gmLat(mid, lon) < gm) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The oval's equatorward edge as one continuous, smooth line across the map. OVATION only
 * reaches 10% where the oval is bright (mostly the night side), so the raw edge has gaps; the
 * oval itself is a ring around the geomagnetic pole, so each gap is filled at the geomagnetic
 * latitude the measured edge sits at, and the 1° stair-steps are smoothed out.
 */
export function continuousEdge(
  edge: [number, number][],
  lon0: number,
  lon1: number,
): [number, number][] {
  if (!edge.length) return [];
  const gms = edge.map(([lon, lat]) => gmLat(lat, lon)).sort((a, b) => a - b);
  const gm = gms[Math.floor(gms.length / 2)];
  const known = new Map(edge.map(([lon, lat]) => [lon, lat]));
  const raw: number[] = [];
  for (let lon = lon0; lon <= lon1; lon++)
    raw.push(known.get(lon) ?? latAtGm(gm, lon));
  const out: [number, number][] = [];
  const W = 3;
  for (let i = 0; i < raw.length; i++) {
    let sum = 0;
    let n = 0;
    for (
      let k = Math.max(0, i - W);
      k <= Math.min(raw.length - 1, i + W);
      k++
    ) {
      sum += raw[k];
      n++;
    }
    out.push([lon0 + i, Math.round((sum / n) * 100) / 100]);
  }
  return out;
}
