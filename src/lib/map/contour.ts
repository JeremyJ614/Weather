/**
 * Filled contours of a grid (marching squares, after d3-contour): the areas where the value
 * is at or above a threshold, as polygons with holes. Grid cell (i, j) has its center at
 * (i + 0.5, j + 0.5) in the output; callers map those to lon/lat. Edges are placed by linear
 * interpolation and the rings rounded off with Chaikin's corner cutting, so bands come out
 * smooth like SPC's outlook areas rather than stepped.
 */
type Pt = [number, number];
type Ring = Pt[];

const CASES: [Pt, Pt][][] = [
  [],
  [
    [
      [1, 1.5],
      [0.5, 1],
    ],
  ],
  [
    [
      [1.5, 1],
      [1, 1.5],
    ],
  ],
  [
    [
      [1.5, 1],
      [0.5, 1],
    ],
  ],
  [
    [
      [1, 0.5],
      [1.5, 1],
    ],
  ],
  [
    [
      [1, 1.5],
      [0.5, 1],
    ],
    [
      [1, 0.5],
      [1.5, 1],
    ],
  ],
  [
    [
      [1, 0.5],
      [1, 1.5],
    ],
  ],
  [
    [
      [1, 0.5],
      [0.5, 1],
    ],
  ],
  [
    [
      [0.5, 1],
      [1, 0.5],
    ],
  ],
  [
    [
      [1, 1.5],
      [1, 0.5],
    ],
  ],
  [
    [
      [0.5, 1],
      [1, 0.5],
    ],
    [
      [1.5, 1],
      [1, 1.5],
    ],
  ],
  [
    [
      [1.5, 1],
      [1, 0.5],
    ],
  ],
  [
    [
      [0.5, 1],
      [1.5, 1],
    ],
  ],
  [
    [
      [1, 1.5],
      [1.5, 1],
    ],
  ],
  [
    [
      [0.5, 1],
      [1, 1.5],
    ],
  ],
  [],
];

type Frag = { start: number; end: number; ring: Ring };

function isorings(
  v: ArrayLike<number>,
  w: number,
  h: number,
  t: number,
  done: (r: Ring) => void,
) {
  const at = (k: number) => (v[k] >= t ? 1 : 0);
  const byStart = new Map<number, Frag>();
  const byEnd = new Map<number, Frag>();
  const index = (p: Pt) => p[0] * 2 + p[1] * (w + 1) * 4;
  let x = -1;
  let y = -1;
  const stitch = ([a, b]: [Pt, Pt]) => {
    const start: Pt = [a[0] + x, a[1] + y];
    const end: Pt = [b[0] + x, b[1] + y];
    const si = index(start);
    const ei = index(end);
    let f = byEnd.get(si);
    if (f) {
      const g = byStart.get(ei);
      if (g) {
        byEnd.delete(f.end);
        byStart.delete(g.start);
        if (f === g) {
          f.ring.push(end);
          done(f.ring);
        } else {
          const n = { start: f.start, end: g.end, ring: f.ring.concat(g.ring) };
          byStart.set(n.start, n);
          byEnd.set(n.end, n);
        }
      } else {
        byEnd.delete(f.end);
        f.ring.push(end);
        f.end = ei;
        byEnd.set(ei, f);
      }
      return;
    }
    f = byStart.get(ei);
    if (f) {
      const g = byEnd.get(si);
      if (g) {
        byStart.delete(f.start);
        byEnd.delete(g.end);
        if (f === g) {
          f.ring.push(end);
          done(f.ring);
        } else {
          const n = { start: g.start, end: f.end, ring: g.ring.concat(f.ring) };
          byStart.set(n.start, n);
          byEnd.set(n.end, n);
        }
      } else {
        byStart.delete(f.start);
        f.ring.unshift(start);
        f.start = si;
        byStart.set(si, f);
      }
      return;
    }
    const n = { start: si, end: ei, ring: [start, end] };
    byStart.set(si, n);
    byEnd.set(ei, n);
  };

  // First row (the row above the grid counts as below the threshold).
  let t0: number;
  let t1 = at(0);
  let t2: number;
  let t3: number;
  CASES[t1 << 1].forEach(stitch);
  while (++x < w - 1) {
    t0 = t1;
    t1 = at(x + 1);
    CASES[t0 | (t1 << 1)].forEach(stitch);
  }
  CASES[t1 << 0].forEach(stitch);
  // Rows in between.
  while (++y < h - 1) {
    x = -1;
    t1 = at(y * w + w);
    t2 = at(y * w);
    CASES[(t1 << 1) | (t2 << 2)].forEach(stitch);
    while (++x < w - 1) {
      t0 = t1;
      t1 = at(y * w + w + x + 1);
      t3 = t2;
      t2 = at(y * w + x + 1);
      CASES[t0 | (t1 << 1) | (t2 << 2) | (t3 << 3)].forEach(stitch);
    }
    CASES[t1 | (t2 << 3)].forEach(stitch);
  }
  // Last row (the row below the grid counts as below).
  x = -1;
  t2 = at(y * w);
  CASES[t2 << 2].forEach(stitch);
  while (++x < w - 1) {
    t3 = t2;
    t2 = at(y * w + x + 1);
    CASES[(t2 << 2) | (t3 << 3)].forEach(stitch);
  }
  CASES[t2 << 3].forEach(stitch);
}

/** Moves each crossing point to where the value actually meets the threshold. */
function interpolate(
  r: Ring,
  v: ArrayLike<number>,
  w: number,
  h: number,
  t: number,
) {
  const at = (k: number) => (Number.isFinite(v[k]) ? v[k] : -1e9);
  const one = (x: number, v0: number, v1: number) => {
    const d = (t - v0) / (v1 - v0);
    return Number.isFinite(d) ? x + d - 0.5 : x;
  };
  for (const p of r) {
    const [x, y] = p;
    const xt = Math.floor(x);
    const yt = Math.floor(y);
    if (x > 0 && x < w && xt === x && yt < h)
      p[0] = one(x, at(yt * w + xt - 1), at(yt * w + xt));
    if (y > 0 && y < h && yt === y && xt < w)
      p[1] = one(y, at((yt - 1) * w + xt), at(yt * w + xt));
  }
}

/** Twice the signed area: positive for an outer ring, negative for a hole. */
export function ringArea(r: Ring) {
  let a = r[r.length - 1][1] * r[0][0] - r[r.length - 1][0] * r[0][1];
  for (let i = 1; i < r.length; i++)
    a += r[i - 1][1] * r[i][0] - r[i - 1][0] * r[i][1];
  return a;
}

function inside(r: Ring, [x, y]: Pt) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
}

/** Douglas–Peucker on a closed ring: drops points within `tol` cells of the line they sit on. */
function simplify(r: Ring, tol: number): Ring {
  if (tol <= 0 || r.length < 8) return r;
  const keep = new Uint8Array(r.length);
  keep[0] = keep[r.length - 1] = 1;
  // A closed ring splits at its far point first, so the first pass has a real chord.
  let far = 0;
  let best = -1;
  for (let i = 1; i < r.length - 1; i++) {
    const d = (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2;
    if (d > best) [best, far] = [d, i];
  }
  keep[far] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, r.length - 1],
  ];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = r[a];
    const dx = r[b][0] - ax;
    const dy = r[b][1] - ay;
    const len = dx * dx + dy * dy;
    let k = -1;
    let m = t2;
    for (let i = a + 1; i < b; i++) {
      const px = r[i][0] - ax;
      const py = r[i][1] - ay;
      const u = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
      const d = (px - u * dx) ** 2 + (py - u * dy) ** 2;
      if (d > m) [m, k] = [d, i];
    }
    if (k < 0) continue;
    keep[k] = 1;
    stack.push([a, k], [k, b]);
  }
  const out = r.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : r;
}

/** Chaikin corner cutting on a closed ring (first point repeated last). */
function chaikin(r: Ring, n: number): Ring {
  let cur = r.slice(0, -1);
  for (let k = 0; k < n && cur.length > 3; k++) {
    const out: Ring = [];
    for (let i = 0; i < cur.length; i++) {
      const [ax, ay] = cur[i];
      const [bx, by] = cur[(i + 1) % cur.length];
      out.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by]);
      out.push([0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    cur = out;
  }
  return [...cur, cur[0]];
}

/**
 * Polygons (outer ring, then holes) where `v` ≥ `t` on a w × h grid, row-major. Rings
 * smaller than `minArea` cells are dropped; `smooth` sets the rounds of corner cutting and
 * `tol` (in cells) thins points that add no visible shape before the smoothing.
 */
export function contours(
  v: ArrayLike<number>,
  w: number,
  h: number,
  t: number,
  { minArea = 1.5, smooth = 2, tol = 0 } = {},
): Ring[][] {
  const polys: Ring[][] = [];
  const holes: Ring[] = [];
  isorings(v, w, h, t, (r) => {
    interpolate(r, v, w, h, t);
    const a = ringArea(r);
    if (Math.abs(a) / 2 < minArea) return;
    const s = chaikin(simplify(r, tol), smooth);
    if (a > 0) polys.push([s]);
    else holes.push(s);
  });
  for (const hole of holes) {
    const p = polys.find((q) => inside(q[0], hole[0]));
    if (p) p.push(hole);
  }
  return polys;
}
