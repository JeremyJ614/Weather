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
  /** Storm object area (km²), when known. */
  size?: number;
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

/** Scales the 20-minute chance (and the fade after it) by a multiplier, keeping 95% the top. */
export function boosted(o: TorOutlook, by: number): TorOutlook {
  if (by === 1) return o;
  const p20 = Math.round(clamp(o.p20 * by, 0, 95));
  return { ...o, p20, p40: Math.round(p20 * 0.7), p60: Math.round(p20 * 0.45) };
}

/** What the browser reads from the nearest radar's lowest scan for one storm. */
export type RadarRead = {
  site: string;
  /** Minutes old when read, beam height (ft) and range (mi) at the storm. */
  age: number;
  beamFt: number;
  miles: number;
  /** Rotational velocity (kt) of the strongest cyclonic couplet, or 0. */
  vrot: number;
  /** A tornado debris signature at the couplet. */
  debris: boolean;
};

/**
 * Rotational velocity on the lowest scan to a tornado chance, after the NWS studies of 0.5°
 * Vrot (Smith and others, 2015): about 10% at 20–30 kt rising to 75% and up past 60 kt.
 */
export function vrotChance(vrot: number) {
  if (vrot < 20) return 0;
  return Math.round(clamp(10 + (vrot - 20) * 1.6, 0, 85));
}

/**
 * Blends a radar read into the outlook: the 20-minute chance moves halfway toward the Vrot
 * chance when that is higher, and a debris signature means a tornado is likely on the ground.
 * Rotation more than 10,000 ft up or over 90 miles out is too high to read and is left out.
 */
export function withRadar(o: TorOutlook, r: RadarRead | undefined): TorOutlook {
  if (!r || r.age > 15) return o;
  const usable = r.beamFt <= 10_000 && r.miles <= 90;
  const v = usable ? vrotChance(r.vrot) : 0;
  let p20 = o.p20;
  if (v > p20) p20 = Math.round((p20 + v) / 2);
  if (r.debris && r.vrot >= 30) p20 = Math.max(p20, 85);
  if (p20 === o.p20) return o;
  return {
    ...o,
    now: r.debris && r.vrot >= 30 ? Math.max(o.now, 85) : o.now,
    p20,
    p40: Math.round(p20 * 0.7),
    p60: Math.round(p20 * 0.45),
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
