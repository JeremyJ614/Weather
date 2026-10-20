/**
 * The arithmetic of dragging a playhead, kept out of the component so it can
 * be tested without a pointer.
 *
 * Two modes, the way a good video scrubber works:
 *
 *   * **follow** — the playhead is under the finger. A press lands where it
 *     lands, and every move puts the playhead back under the finger.
 *   * **fine** — slide the finger up (or down) off the bar and the playhead
 *     stops following it and starts moving by a fraction of what the finger
 *     moves: half, then a fifth, then a twentieth. On a phone a three-hour day
 *     is 350 pixels, thirty seconds a pixel; this is what makes landing on a
 *     single minute possible. Coming back down to the bar does not snap back
 *     under the finger, because a jump at the end of a careful adjustment is
 *     the worst thing a scrubber can do.
 */

import { dateFormat } from "@/features/replay/core/intl";

/** How much of the finger's movement reaches the playhead, by distance off the bar. */
export function precisionFor(offBarPx: number): number {
  const d = Math.abs(offBarPx);
  if (d < 44) return 1;
  if (d < 100) return 0.5;
  if (d < 170) return 0.2;
  return 0.05;
}

export class ScrubDrag {
  private lastX = 0;
  private at = 0;
  private fine = false;

  /**
   * @param from,to  the span the bar shows, seconds
   * @param width    the bar's width in pixels
   * @param barY     the bar's vertical centre in client pixels
   */
  constructor(
    private from: number,
    private to: number,
    private width: number,
    private barY: number,
  ) {}

  private secondsPerPx(): number {
    return (this.to - this.from) / Math.max(1, this.width);
  }

  /** The press: the playhead goes where the finger is. */
  start(x: number, left: number): number {
    this.lastX = x;
    this.fine = false;
    this.at = this.clamp(this.from + (x - left) * this.secondsPerPx());
    return this.at;
  }

  /** A move: under the finger, or by a fraction of the movement once fine. */
  move(x: number, y: number, left: number): number {
    const p = precisionFor(y - this.barY);
    if (p < 1) this.fine = true;
    if (!this.fine) {
      this.at = this.clamp(this.from + (x - left) * this.secondsPerPx());
    } else {
      this.at = this.clamp(
        this.at + (x - this.lastX) * this.secondsPerPx() * p,
      );
    }
    this.lastX = x;
    return this.at;
  }

  /** Whether the drag has gone fine — detents are off then, it is a deliberate placement. */
  get isFine(): boolean {
    return this.fine;
  }

  /** The precision now, for the readout. */
  precision(y: number): number {
    return this.fine ? precisionFor(y - this.barY) : 1;
  }

  private clamp(v: number): number {
    return Math.min(this.to, Math.max(this.from, v));
  }
}

/**
 * Clock ticks for an axis: a round step for the span and the width, labelled
 * in the chase's own time zone.
 */
export function clockTicks(
  from: number,
  to: number,
  T0: number,
  tz: string,
  widthPx: number,
): { at: number; label: string; major: boolean }[] {
  const span = Math.max(1, to - from);
  const steps = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600];
  // At least ~70 px between labels.
  const want = (span / Math.max(1, widthPx)) * 70;
  const step = steps.find((s) => s >= want) ?? 43200;
  // Align to the step in local time: find the local offset once.
  const offset = localOffsetSeconds(T0 + from, tz);
  const first = Math.ceil((T0 + from + offset) / step) * step - offset - T0;
  const out: { at: number; label: string; major: boolean }[] = [];
  for (let t = first; t <= to; t += step) {
    const local = T0 + t + offset;
    const major = local % Math.max(step * 4, 3600) === 0;
    out.push({ at: t, label: clockLabel(T0 + t, tz, step < 3600), major });
  }
  return out;
}

export function clockLabel(epoch: number, tz: string, minutes = true): string {
  try {
    return dateFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      ...(minutes ? { minute: "2-digit" } : {}),
    }).format(new Date(epoch * 1000));
  } catch {
    return new Date(epoch * 1000).toISOString().slice(11, 16);
  }
}

function localOffsetSeconds(epoch: number, tz: string): number {
  try {
    const parts = dateFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(epoch * 1000));
    const g = (t: string) =>
      Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc =
      Date.UTC(
        g("year"),
        g("month") - 1,
        g("day"),
        g("hour") % 24,
        g("minute"),
        g("second"),
      ) / 1000;
    return Math.round(asUtc - Math.floor(epoch));
  } catch {
    return 0;
  }
}
