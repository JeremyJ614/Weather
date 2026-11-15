/**
 * Squall-line tornado boost for ProbTor (post-launch A6). ProbSevere under-forecasts tornadoes
 * in lines of storms (QLCS), so storms that sit in a line are tested with the Three Ingredients
 * Method (Schaumann and Przybylinski 2012): 0–3 km shear of 30 kt or more, a line-normal part of
 * that shear of 30 kt or more, and a surging or bowing segment. Pure math: shared by the server
 * and the tests.
 */
import type { Cell } from "./project";

const KM = 111.32;

export type LineFit = {
  /** Unit vector along the line (east, north). */
  along: [number, number];
  /** Line length (km). */
  km: number;
  /** Cell IDs in the line. */
  ids: string[];
  /** Median motion normal to the line (m/s, + toward `normal`). */
  push: number;
  /** Unit vector across the line, pointing the way the line moves. */
  normal: [number, number];
  /** Center (lon, lat). */
  at: [number, number];
};

/** Principal axis of points in km around their mean: unit vector, spread along and across. */
function axis(pts: [number, number][]) {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l2 = Math.max(1e-6, tr - l1);
  const v: [number, number] =
    Math.abs(sxy) > 1e-9 ? [l1 - syy, sxy] : sxx >= syy ? [1, 0] : [0, 1];
  const len = Math.hypot(v[0], v[1]) || 1;
  return {
    dir: [v[0] / len, v[1] / len] as [number, number],
    l1,
    l2,
    mx,
    my,
  };
}

/**
 * Lines of storms: cells whose centers are within 40 km chain together; a chain of three or
 * more stretched at least 3:1 and 80 km long is a line. One storm object stretched 3:1 and 60 km
 * long (ProbSevere often draws a squall line as a single object) is a line on its own.
 */
export function findLines(cells: Cell[]): LineFit[] {
  const lat0 = cells.length
    ? cells.reduce((a, c) => a + c.lat, 0) / cells.length
    : 40;
  const kx = KM * Math.cos((lat0 * Math.PI) / 180);
  const xy = (lon: number, lat: number): [number, number] => [
    lon * kx,
    lat * KM,
  ];
  const parent = cells.map((_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]));
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const [ax, ay] = xy(cells[i].lon, cells[i].lat);
      const [bx, by] = xy(cells[j].lon, cells[j].lat);
      if (Math.hypot(ax - bx, ay - by) <= 40) parent[root(i)] = root(j);
    }
  const groups = new Map<number, Cell[]>();
  cells.forEach((c, i) => {
    const r = root(i);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  });
  const out: LineFit[] = [];
  for (const g of groups.values()) {
    const pts = g.flatMap((c) =>
      c.ring.length ? c.ring.map(([lo, la]) => xy(lo, la)) : [xy(c.lon, c.lat)],
    );
    if (pts.length < 3) continue;
    const a = axis(pts);
    const km = 4 * Math.sqrt(a.l1);
    const aspect = Math.sqrt(a.l1 / a.l2);
    const isLine =
      aspect >= 3 &&
      ((g.length >= 3 && km >= 80) || (g.length < 3 && km >= 60));
    if (!isLine) continue;
    let normal: [number, number] = [-a.dir[1], a.dir[0]];
    const pushes = g.map((c) => c.east * normal[0] + c.north * normal[1]);
    const med = [...pushes].sort((p, q) => p - q)[pushes.length >> 1];
    if (med < 0) normal = [-normal[0], -normal[1]];
    out.push({
      along: a.dir,
      km: Math.round(km),
      ids: g.map((c) => c.id),
      push: Math.abs(med),
      normal,
      at: [a.mx / kx, a.my / KM],
    });
  }
  return out;
}

export type Ingredients = {
  /** 0–3 km shear (kt) and its part across the line (kt). */
  shear: number;
  across: number;
  /** This storm is surging ahead of the rest of the line. */
  surge: boolean;
  /** How many of the three ingredients are met. */
  met: number;
  /** Multiplier on ProbTor's 20-minute chance. */
  boost: number;
};

/**
 * The Three Ingredients for one storm in a line. `shear` is the 0–3 km shear vector (east, north)
 * in knots. A storm surges when it moves across the line 3 m/s faster than the line's median.
 */
export function ingredients(
  c: Cell,
  line: LineFit,
  shear: [number, number],
): Ingredients {
  const mag = Math.hypot(shear[0], shear[1]);
  const across = Math.abs(
    shear[0] * line.normal[0] + shear[1] * line.normal[1],
  );
  const push = c.east * line.normal[0] + c.north * line.normal[1];
  const surge = push - line.push >= 3;
  const one = mag >= 30;
  const two = across >= 30;
  const met = Number(one) + Number(two) + Number(surge);
  // Ingredients 1 and 2 set up the mesovortex; the surge is where it spins up.
  const boost = one && two ? (surge ? 2 : 1.5) : one && surge ? 1.25 : 1;
  return {
    shear: Math.round(mag),
    across: Math.round(across),
    surge,
    met,
    boost,
  };
}
