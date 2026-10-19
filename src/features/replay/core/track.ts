import { haversine, pointToSegment, projector } from "./geo";

/**
 * A GPS track, stored as three parallel typed arrays.
 *
 * Structure-of-arrays rather than an array of triples: roughly five times less
 * memory for a 30,000-fix track, far better cache behaviour when the same track
 * is swept repeatedly, and it transfers to a worker with zero copying.
 *
 * The full track is never thinned. The old build dropped any fix that was under
 * four seconds AND under sixty metres from the last one kept, which deletes an
 * entire hairpin taken slowly — the reported cut-corner bug. Here, simplification
 * produces an *index list* into the full data and is used only for drawing;
 * every measurement reads the full arrays.
 */
export class Track {
  readonly t: Float64Array;
  readonly lat: Float64Array;
  readonly lon: Float64Array;
  readonly n: number;
  /** Cumulative distance in metres at each fix. */
  readonly cum: Float64Array;

  private lodCache = new Map<number, Uint32Array>();

  constructor(t: Float64Array, lat: Float64Array, lon: Float64Array) {
    if (t.length !== lat.length || t.length !== lon.length) {
      throw new Error("Track arrays must be the same length");
    }
    this.t = t;
    this.lat = lat;
    this.lon = lon;
    this.n = t.length;

    const cum = new Float64Array(this.n);
    for (let i = 1; i < this.n; i += 1) {
      cum[i] =
        cum[i - 1]! + haversine(lat[i - 1]!, lon[i - 1]!, lat[i]!, lon[i]!);
    }
    this.cum = cum;
  }

  static fromFixes(
    fixes: readonly (readonly [number, number, number])[],
  ): Track {
    const sorted = [...fixes].sort((a, b) => a[0] - b[0]);
    const n = sorted.length;
    const t = new Float64Array(n);
    const lat = new Float64Array(n);
    const lon = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      const f = sorted[i]!;
      t[i] = f[0];
      lat[i] = f[1];
      lon[i] = f[2];
    }
    return new Track(t, lat, lon);
  }

  get totalMetres(): number {
    return this.n ? this.cum[this.n - 1]! : 0;
  }
  get startTime(): number {
    return this.n ? this.t[0]! : 0;
  }
  get endTime(): number {
    return this.n ? this.t[this.n - 1]! : 0;
  }

  /** Index of the last fix at or before `time`. */
  indexAt(time: number): number {
    if (this.n === 0) return -1;
    if (time <= this.t[0]!) return 0;
    if (time >= this.t[this.n - 1]!) return this.n - 1;
    let lo = 0;
    let hi = this.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.t[mid]! <= time) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** Position at `time`, interpolated between the two surrounding fixes. */
  positionAt(time: number): { lat: number; lon: number; index: number } {
    const i = this.indexAt(time);
    if (i < 0) return { lat: 0, lon: 0, index: -1 };
    const j = Math.min(i + 1, this.n - 1);
    const span = this.t[j]! - this.t[i]!;
    const f =
      span === 0 ? 0 : Math.max(0, Math.min(1, (time - this.t[i]!) / span));
    return {
      lat: this.lat[i]! + f * (this.lat[j]! - this.lat[i]!),
      lon: this.lon[i]! + f * (this.lon[j]! - this.lon[i]!),
      index: i,
    };
  }

  /** Ground speed in m/s around `time`, smoothed over a short window. */
  speedAt(time: number, windowSec = 6): number {
    const i = this.indexAt(time);
    if (i < 0 || this.n < 2) return 0;
    let a = i;
    let b = i;
    while (a > 0 && this.t[i]! - this.t[a]! < windowSec / 2) a -= 1;
    while (b < this.n - 1 && this.t[b]! - this.t[i]! < windowSec / 2) b += 1;
    const dt = this.t[b]! - this.t[a]!;
    if (dt <= 0) return 0;
    return (this.cum[b]! - this.cum[a]!) / dt;
  }

  /**
   * Douglas–Peucker simplification, returning indices into the full track.
   *
   * Error-bounded rather than distance-based: a point is dropped only when the
   * line drawn without it stays within `toleranceM` of it. A slow hairpin has a
   * large perpendicular error, so it survives at every tolerance that matters —
   * which is exactly what the old thinning got wrong.
   */
  simplify(toleranceM: number): Uint32Array {
    const cached = this.lodCache.get(toleranceM);
    if (cached) return cached;
    if (this.n <= 2) {
      const all = new Uint32Array(this.n);
      for (let i = 0; i < this.n; i += 1) all[i] = i;
      this.lodCache.set(toleranceM, all);
      return all;
    }

    const proj = projector(this.lat[0]!);
    const xs = new Float64Array(this.n);
    const ys = new Float64Array(this.n);
    for (let i = 0; i < this.n; i += 1) {
      xs[i] = proj.x(this.lon[i]!);
      ys[i] = proj.y(this.lat[i]!);
    }

    const keep = new Uint8Array(this.n);
    keep[0] = 1;
    keep[this.n - 1] = 1;

    // Explicit stack; a 30,000-point track would blow the call stack recursing.
    const stack: number[] = [0, this.n - 1];
    while (stack.length) {
      const end = stack.pop()!;
      const start = stack.pop()!;
      let worst = 0;
      let worstIdx = -1;
      for (let i = start + 1; i < end; i += 1) {
        const d = pointToSegment(
          xs[i]!,
          ys[i]!,
          xs[start]!,
          ys[start]!,
          xs[end]!,
          ys[end]!,
        );
        if (d > worst) {
          worst = d;
          worstIdx = i;
        }
      }
      if (worstIdx !== -1 && worst > toleranceM) {
        keep[worstIdx] = 1;
        stack.push(start, worstIdx, worstIdx, end);
      }
    }

    let count = 0;
    for (let i = 0; i < this.n; i += 1) if (keep[i]) count += 1;
    const out = new Uint32Array(count);
    let k = 0;
    for (let i = 0; i < this.n; i += 1) if (keep[i]) out[k++] = i;

    this.lodCache.set(toleranceM, out);
    return out;
  }

  /**
   * The index list to draw at a given map zoom.
   *
   * Tolerance is tied to how many metres one screen pixel covers, so the
   * simplification is always invisible: a dropped point could not have moved the
   * drawn line by more than half a pixel.
   */
  forZoom(
    zoom: number,
    latitude = this.lat[0] ?? 0,
    devicePixelRatio = 1,
  ): Uint32Array {
    const metresPerPixel =
      (156_543.03392 * Math.cos(latitude * (Math.PI / 180))) /
      2 ** zoom /
      devicePixelRatio;
    const tolerance = Math.max(0.5, metresPerPixel * 0.5);
    // Quantise so nearby zooms share a cache entry rather than recomputing.
    const bucket = Math.max(0.5, 2 ** Math.round(Math.log2(tolerance)));
    return this.simplify(bucket);
  }

  /** Bounding box as [minLat, minLon, maxLat, maxLon]. */
  bounds(): [number, number, number, number] {
    let minLat = Infinity;
    let minLon = Infinity;
    let maxLat = -Infinity;
    let maxLon = -Infinity;
    for (let i = 0; i < this.n; i += 1) {
      if (this.lat[i]! < minLat) minLat = this.lat[i]!;
      if (this.lat[i]! > maxLat) maxLat = this.lat[i]!;
      if (this.lon[i]! < minLon) minLon = this.lon[i]!;
      if (this.lon[i]! > maxLon) maxLon = this.lon[i]!;
    }
    return [minLat, minLon, maxLat, maxLon];
  }

  /** Transferable buffers, for handing the track to a worker with no copy. */
  transferables(): ArrayBuffer[] {
    return [
      this.t.buffer as ArrayBuffer,
      this.lat.buffer as ArrayBuffer,
      this.lon.buffer as ArrayBuffer,
    ];
  }
}
