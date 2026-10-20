import type { Gates, Moment, Radial } from "./format";

/**
 * One moment of one scan, laid out for the GPU: a row per azimuth step, a
 * column per range gate, one byte each.
 *
 * Radials are not quite evenly spaced — the antenna turns at whatever rate the
 * scan asks and each ray lands where it lands — so rows are fixed steps round
 * the circle and each takes the nearest radial. The shader can then find a
 * pixel's row by dividing its bearing by the step, with no search.
 */
export interface Sweep {
  moment: Moment;
  /** The cut's number within its volume. */
  elev: number;
  /** Degrees above the horizon. */
  angle: number;
  /** Epoch milliseconds of the first and last radials. */
  start: number;
  end: number;
  /** Rows round the circle: 720 at half a degree, 360 at one. */
  rows: number;
  gates: number;
  first: number;
  spacing: number;
  scale: number;
  offset: number;
  /** rows x gates, row-major. */
  data: Uint8Array;
  /** Metres per second at which velocity folds, when known. */
  nyquist: number | null;
}

/** How far the lowest scan reaches upward before the collector counts it as finished. */
const LOWEST_BAND = 0.35;

/**
 * Gathers the radials of a volume's lowest scan, moment by moment, and says
 * when it has them all.
 *
 * Radar volumes are read front to back and the lowest scan comes first, so
 * this is what lets a reader stop after the first few megabytes of a file
 * that runs to twenty. Each moment is taken from the first cut that carries
 * it: reflectivity and correlation from the long-range surveillance cut,
 * velocity from the Doppler cut the radar flies at the same angle straight
 * after.
 */
export class LowestScan {
  private lowest: number | null = null;
  private readonly cuts = new Map<number, Radial[]>();
  private readonly chosen: Partial<Record<Moment, number>> = {};
  private finished = false;
  site: { lat: number; lon: number; height: number } | null = null;

  add(r: Radial) {
    if (this.finished) return;
    if (r.site && !this.site) this.site = r.site;
    // Some old volumes open with a stray radial at the previous volume's top
    // angle; the lowest scan starts at the first radial carrying data.
    const hasData = Object.keys(r.moments).length > 0;
    if (this.lowest === null) {
      if (!hasData) return;
      this.lowest = r.angle;
    }
    if (r.angle > this.lowest + LOWEST_BAND) {
      // The antenna has moved up: the lowest scan is complete.
      if (this.cuts.size > 0) this.finished = true;
      return;
    }
    // A late return to the bottom (SAILS repeats it mid-volume) is not ours.
    if (r.angle < this.lowest - LOWEST_BAND) return;
    let list = this.cuts.get(r.elev);
    if (!list) {
      list = [];
      this.cuts.set(r.elev, list);
    }
    list.push(r);
    for (const m of Object.keys(r.moments) as Moment[]) {
      if (this.chosen[m] === undefined) this.chosen[m] = r.elev;
    }
  }

  /** True once the antenna has left the lowest scan. */
  get done(): boolean {
    return this.finished;
  }

  /** Radials held, for progress. */
  get radials(): number {
    let n = 0;
    for (const l of this.cuts.values()) n += l.length;
    return n;
  }

  sweeps(): Partial<Record<Moment, Sweep>> {
    const out: Partial<Record<Moment, Sweep>> = {};
    for (const [m, elev] of Object.entries(this.chosen) as [Moment, number][]) {
      const s = buildSweep(this.cuts.get(elev) ?? [], m);
      if (s) out[m] = s;
    }
    return out;
  }
}

/** Grid one moment of one cut. */
export function buildSweep(
  radials: readonly Radial[],
  moment: Moment,
): Sweep | null {
  const rays: { az: number; g: Gates; r: Radial }[] = [];
  for (const r of radials) {
    const g = r.moments[moment];
    if (g) rays.push({ az: ((r.az % 360) + 360) % 360, g, r });
  }
  if (rays.length < 8) return null;
  rays.sort((a, b) => a.az - b.az);

  const head = rays[0]!;
  const fine =
    rays.filter((x) => x.r.width === 0.5).length > rays.length / 2 ||
    rays.length > 500;
  const rows = fine ? 720 : 360;
  const step = 360 / rows;
  let gates = 0;
  for (const x of rays) gates = Math.max(gates, x.g.data.length);
  const data = new Uint8Array(rows * gates);

  // Row i covers [i*step, (i+1)*step); give it the radial nearest its centre,
  // unless the nearest is further than a radial and a half away (a gap in the
  // scan stays a gap).
  const azs = rays.map((x) => x.az);
  for (let i = 0; i < rows; i += 1) {
    const c = (i + 0.5) * step;
    const k = nearest(azs, c);
    const ray = rays[k]!;
    const gap = Math.abs(((ray.az - c + 540) % 360) - 180);
    if (gap > step * 1.5 && gap > 0.75) continue;
    data.set(ray.g.data.subarray(0, gates), i * gates);
  }

  let start = Infinity,
    end = -Infinity,
    nyquist: number | null = null;
  for (const x of rays) {
    start = Math.min(start, x.r.time);
    end = Math.max(end, x.r.time);
    if (x.r.nyquist && nyquist === null) nyquist = x.r.nyquist;
  }
  return {
    moment,
    elev: head.r.elev,
    angle: median(rays.map((x) => x.r.angle)),
    start,
    end,
    rows,
    gates,
    first: head.g.first,
    spacing: head.g.spacing,
    scale: head.g.scale,
    offset: head.g.offset,
    data,
    nyquist,
  };
}

/** Index of the value in a sorted circular list nearest to `x` degrees. */
function nearest(sorted: readonly number[], x: number): number {
  let lo = 0,
    hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  const n = sorted.length;
  const a = (lo - 1 + n) % n,
    b = lo % n;
  const da = Math.abs(((sorted[a]! - x + 540) % 360) - 180);
  const db = Math.abs(((sorted[b]! - x + 540) % 360) - 180);
  return da <= db ? a : b;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** A decoded value for a code, or null for "nothing here" and "range folded". */
export function valueOf(
  s: Pick<Sweep, "scale" | "offset">,
  code: number,
): number | null {
  if (code < 2) return null;
  return (code - s.offset) / s.scale;
}
