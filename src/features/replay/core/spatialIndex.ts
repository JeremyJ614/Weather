import { pointToSegment, projector } from "./geo";

export interface Segment {
  /** Which feature this segment belongs to. */
  id: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Distance along the feature at the segment's start, in metres. */
  s0: number;
  s1: number;
}

export interface NearestHit {
  id: number;
  /** Perpendicular distance in metres. */
  distance: number;
  /** Distance along the feature at the closest point, in metres. */
  along: number;
}

/**
 * Uniform grid over line segments.
 *
 * The old build answered "which tornado track is this damage point nearest?" by
 * scanning every segment of every track for every point — 1,142 points against
 * twelve tracks on the March 2026 chase alone. A grid turns that into a handful
 * of bucket lookups, which is what makes hover-to-inspect and road naming
 * affordable at all.
 *
 * A uniform grid rather than an R-tree on purpose: chase geometry is roughly
 * evenly spread along roads and tracks, so the pathological clustering that
 * makes a grid degenerate does not arise, and the build is a single pass.
 */
export class SpatialIndex {
  private readonly cell: number;
  private readonly buckets = new Map<number, number[]>();
  private readonly segments: Segment[] = [];
  private readonly proj: ReturnType<typeof projector>;

  constructor(refLat: number, cellMetres = 2_000) {
    this.cell = cellMetres;
    this.proj = projector(refLat);
  }

  private key(cx: number, cy: number): number {
    // Pack two signed cell coordinates into one number; ±2^15 cells is ±65,000 km.
    return ((cx + 32_768) << 16) | (cy + 32_768);
  }

  /** Add one feature's polyline, given as [lon, lat] pairs. */
  addFeature(id: number, coords: readonly (readonly [number, number])[]): void {
    if (coords.length < 2) return;
    let along = 0;
    for (let i = 1; i < coords.length; i += 1) {
      const a = coords[i - 1]!;
      const b = coords[i]!;
      const ax = this.proj.x(a[0]);
      const ay = this.proj.y(a[1]);
      const bx = this.proj.x(b[0]);
      const by = this.proj.y(b[1]);
      const len = Math.hypot(bx - ax, by - ay);
      const idx = this.segments.length;
      this.segments.push({ id, ax, ay, bx, by, s0: along, s1: along + len });
      along += len;

      // Stamp the segment into every cell its bounding box touches.
      const cx0 = Math.floor(Math.min(ax, bx) / this.cell);
      const cx1 = Math.floor(Math.max(ax, bx) / this.cell);
      const cy0 = Math.floor(Math.min(ay, by) / this.cell);
      const cy1 = Math.floor(Math.max(ay, by) / this.cell);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        for (let cy = cy0; cy <= cy1; cy += 1) {
          const k = this.key(cx, cy);
          const bucket = this.buckets.get(k);
          if (bucket) bucket.push(idx);
          else this.buckets.set(k, [idx]);
        }
      }
    }
  }

  /**
   * Nearest feature to a point, or null if nothing is within `maxMetres`.
   *
   * Searches outward in rings so it can stop as soon as the next ring cannot
   * contain anything closer than what has already been found.
   */
  nearest(lat: number, lon: number, maxMetres = 5_000): NearestHit | null {
    const px = this.proj.x(lon);
    const py = this.proj.y(lat);
    const cx = Math.floor(px / this.cell);
    const cy = Math.floor(py / this.cell);
    const maxRing = Math.ceil(maxMetres / this.cell);

    let best: NearestHit | null = null;
    const seen = new Set<number>();

    for (let ring = 0; ring <= maxRing; ring += 1) {
      // Anything in this ring is at least (ring - 1) cells away.
      if (best && (ring - 1) * this.cell > best.distance) break;

      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring)
            continue;
          const bucket = this.buckets.get(this.key(cx + dx, cy + dy));
          if (!bucket) continue;
          for (const si of bucket) {
            if (seen.has(si)) continue;
            seen.add(si);
            const s = this.segments[si]!;
            const d = pointToSegment(px, py, s.ax, s.ay, s.bx, s.by);
            if (d > maxMetres) continue;
            if (!best || d < best.distance) {
              const segLen = s.s1 - s.s0;
              const dxs = s.bx - s.ax;
              const dys = s.by - s.ay;
              const len2 = dxs * dxs + dys * dys;
              let u = len2 ? ((px - s.ax) * dxs + (py - s.ay) * dys) / len2 : 0;
              u = Math.max(0, Math.min(1, u));
              best = { id: s.id, distance: d, along: s.s0 + u * segLen };
            }
          }
        }
      }
    }
    return best;
  }

  get size(): number {
    return this.segments.length;
  }
}
