/**
 * ProbTor (Extras engine): NOAA/CIMSS ProbSevere v3 storms, carried forward along their
 * own motion. Pure math, shared by the server route and the tests.
 *
 * ProbTor starts from ProbSevere's tornado probability and nudges the next 20 minutes by the
 * low-level rotation trend (MRMS azimuthal shear, now vs. ~10 minutes ago) and a lightning
 * jump (ProbSevere's own LJA flag or the flash rate jumping). Beyond 20 minutes it only
 * fades: skill drops off fast, and the page says so.
 */
export type Cell = {
  id: string;
  lat: number;
  lon: number;
  ring: [number, number][];
  tor: number;
  wind: number;
  severe: number;
  /** Low-level azimuthal shear (s⁻¹), flash rate (per minute). */
  az: number;
  flash: number;
  jump: boolean;
  /** Storm motion toward the east and north (m/s). */
  east: number;
  north: number;
};

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

export type TorOutlook = {
  now: number;
  p20: number;
  p40: number;
  p60: number;
  trend: "rising" | "steady" | "falling";
  jump: boolean;
};

export function torOutlook(c: Cell, before?: Cell): TorOutlook {
  const dAz = before ? c.az - before.az : 0;
  const trend = dAz > 0.002 ? "rising" : dAz < -0.002 ? "falling" : "steady";
  const jump =
    c.jump || Boolean(before && c.flash >= 10 && c.flash >= before.flash * 1.5);
  const nudge = 1 + clamp(dAz / 0.004, -0.5, 0.6) * 0.5 + (jump ? 0.15 : 0);
  const p20 = Math.round(clamp(c.tor * nudge, 0, 95));
  return {
    now: Math.round(c.tor),
    p20,
    p40: Math.round(p20 * 0.7),
    p60: Math.round(p20 * 0.45),
    trend,
    jump,
  };
}

/** Where the storm's center will be after `min` minutes on its current motion. */
export function ahead(c: Cell, min: number): [number, number] {
  const s = min * 60;
  const k = 111_320;
  return [
    c.lon + (c.east * s) / (k * Math.cos((c.lat * Math.PI) / 180)),
    c.lat + (c.north * s) / k,
  ];
}

/** Convex hull (monotone chain) of lon/lat points, closed. */
export function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return [...p, p[0]];
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0
    )
      lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0
    )
      upper.pop();
    upper.push(q);
  }
  const h = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return [...h, h[0]];
}

const circle = ([lon, lat]: [number, number], km: number): [number, number][] =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [
      lon + (km * Math.cos(a)) / (111.32 * Math.cos((lat * Math.PI) / 180)),
      lat + (km * Math.sin(a)) / 111.32,
    ];
  });

/** The cone a storm sweeps between two times; it widens 0.25 km a minute for track error. */
export function cone(c: Cell, from: number, to: number): [number, number][] {
  const w = (t: number) => 4 + 0.25 * t;
  return hull([
    ...circle(ahead(c, from), w(from)),
    ...circle(ahead(c, to), w(to)),
  ]);
}

const COMPASS = "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split(
  " ",
);
/** Storm motion as mph and the compass point it is heading toward. */
export function motion(c: Cell) {
  const ms = Math.hypot(c.east, c.north);
  const deg = ((Math.atan2(c.east, c.north) * 180) / Math.PI + 360) % 360;
  return {
    mph: Math.round(ms * 2.237),
    toward: COMPASS[Math.round(deg / 22.5) % 16],
  };
}
