/**
 * Things that appear on the clock, without rebuilding the map's data to do it.
 *
 * Damage points, hail and photo pins all arrive at a moment and then stay.
 * They used to be drawn by building a fresh GeoJSON collection of "everything
 * visible so far" and handing it to `setData` on every frame. That is the most
 * expensive thing a MapLibre source can be asked to do — the whole collection
 * goes to a worker and is re-tiled from scratch — and at sixty frames a second
 * the worker never caught up. On a phone the damage layer showed nothing for
 * the whole replay (#22), and the hail and warnings blinked in and out as each
 * rebuild landed (#8).
 *
 * So the collection is now set once, with every feature in it, and what
 * changes per frame is each feature's *state*: a number from 0 (not yet) to 1
 * (fully arrived) that the paint reads through `feature-state`. Setting state
 * touches only the paint buffers of the features that changed; nothing is
 * re-tiled.
 *
 * This class decides which features changed. It is pure — no map in here — so
 * the rule "the map ends up exactly where brute force would put it, whatever
 * order the clock moved in" can be tested directly.
 */
export class Reveal {
  /** Reveal times, ascending. */
  private readonly times: Float64Array;
  /** Feature id for each entry of `times`. */
  private readonly ids: Int32Array;
  /**
   * The last level written for each feature id, in steps of 1/`steps`;
   * -1 means "unknown, write it". Whole numbers on purpose: comparing floats
   * stored at one precision against floats computed at another says "changed"
   * every time, which turned a fade into a write per frame.
   */
  private readonly written: Int16Array;
  private last: number | null = null;

  /**
   * @param revealAt when each feature (by id = array index) appears. A
   *   non-finite time means "from the start" — a point with nothing to tie it
   *   to is still data, and hiding it would be a claim that it is not.
   * @param fade seconds a feature takes to fade up, so a town arrives as
   *   weather rather than as a wall of dots appearing in one frame.
   * @param steps opacity is quantised to this many levels. Nobody can see the
   *   difference between 1/24 and 1/1000, and quantising means a fade costs
   *   two dozen writes instead of one per frame for a minute.
   */
  constructor(
    revealAt: readonly number[],
    readonly fade: number,
    readonly steps = 24,
  ) {
    const n = revealAt.length;
    const order = Array.from({ length: n }, (_, i) => i);
    const at = (i: number) => {
      const t = revealAt[i]!;
      return Number.isFinite(t) ? t : -Infinity;
    };
    order.sort((a, b) => at(a) - at(b));
    this.times = Float64Array.from(order, at);
    this.ids = Int32Array.from(order);
    this.written = new Int16Array(n).fill(-1);
  }

  get size(): number {
    return this.ids.length;
  }

  /** 0..1 for a feature revealed at `t`, seen at `at`. */
  valueAt(t: number, at: number): number {
    return this.levelAt(t, at) / this.steps;
  }

  /** The same, as a whole number of steps. */
  private levelAt(t: number, at: number): number {
    if (at < t) return 0;
    if (this.fade <= 0 || !Number.isFinite(t)) return this.steps;
    return Math.round(Math.min(1, (at - t) / this.fade) * this.steps);
  }

  /**
   * Forget what has been written, so the next `step` rewrites everything.
   *
   * Called after anything that throws feature state away behind our back —
   * a basemap swap rebuilds every source, and the state goes with them.
   */
  reset(): void {
    this.written.fill(-1);
    this.last = null;
  }

  /**
   * Bring every feature to its value at `at`, calling `write` only for the
   * ones whose value actually changes.
   *
   * A feature's value can only differ between two instants if its fade window
   * [t, t + fade] overlaps the span between them, so only reveal times in
   * (lo - fade, hi] are visited — found by binary search. Playing forwards
   * visits a handful; a long scrub visits what it crossed; nothing else is
   * touched.
   */
  step(at: number, write: (id: number, value: number) => void): number {
    let writes = 0;
    const visit = (k: number) => {
      const id = this.ids[k]!;
      const level = this.levelAt(this.times[k]!, at);
      if (this.written[id] !== level) {
        this.written[id] = level;
        write(id, level / this.steps);
        writes += 1;
      }
    };

    if (this.last === null) {
      for (let k = 0; k < this.ids.length; k += 1) visit(k);
    } else {
      const lo = Math.min(this.last, at) - this.fade;
      const hi = Math.max(this.last, at);
      for (
        let k = this.firstAfter(lo);
        k < this.times.length && this.times[k]! <= hi;
        k += 1
      ) {
        visit(k);
      }
    }
    this.last = at;
    return writes;
  }

  /** Index of the first reveal time strictly greater than `t`. */
  private firstAfter(t: number): number {
    let lo = 0;
    let hi = this.times.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.times[mid]! <= t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
