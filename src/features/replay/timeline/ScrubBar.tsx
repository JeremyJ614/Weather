import { useCallback, useMemo, useRef, useState } from "react";
import { PAL } from "@/features/replay/palette";
import {
  layoutWarnings,
  radiusFor,
  snap,
  step,
  stripChart,
  type Moment,
  type TornadoSpan,
  type WarningSpan,
} from "./snap";
import { elapsed } from "./Clock";

interface ScrubBarProps {
  /** [start, end] in seconds from T0. */
  window: [number, number];
  at: number;
  onScrub: (at: number) => void;
  tornadoes: readonly TornadoSpan[];
  warnings?: readonly WarningSpan[];
  moments?: readonly Moment[];
  /** Turn the detents off — a setting, like everything else. */
  snapping?: boolean;
  /** Label for the moment currently under the playhead. */
  onMoment?: (m: Moment | null) => void;
}

const LANE_HEIGHT = 7;
const STRIP_HEIGHT = 34;

/**
 * The scrub bar: a strip chart of the day, a warning lane, and detents.
 *
 * A plain slider across three hours tells the reader nothing about where the
 * day's weather was, and makes landing on a touchdown a matter of luck. This
 * shows the shape of the day (Z3 #18), what was warned and when (Z1 #09), and
 * catches on the moments worth catching on (Z3 #19).
 */
export function ScrubBar({
  window: win,
  at,
  onScrub,
  tornadoes,
  warnings = [],
  moments = [],
  snapping = true,
  onMoment,
}: ScrubBarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const [from, to] = win;
  const span = Math.max(1, to - from);

  const measure = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (el) setWidth(el.clientWidth);
  }, []);

  const bands = useMemo(
    () => stripChart(win, tornadoes, 160),
    [win, tornadoes],
  );
  const lanes = useMemo(() => layoutWarnings(warnings), [warnings]);
  const laneCount = lanes.reduce((n, w) => Math.max(n, w.row + 1), 0);

  const toSeconds = (clientX: number): number => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return at;
    const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return from + f * span;
  };

  const place = (seconds: number) => {
    if (!snapping) {
      onScrub(seconds);
      onMoment?.(null);
      return;
    }
    // The detent is a fixed distance on screen, converted to seconds, so it
    // feels identical on a phone and on a wide monitor.
    const res = snap(seconds, moments, radiusFor(span, width));
    onScrub(res.at);
    onMoment?.(res.moment);
  };

  const pct = (seconds: number) => ((seconds - from) / span) * 100;

  const onKey = (e: React.KeyboardEvent) => {
    const nudge = span / 200;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      // Shift jumps between moments; otherwise it is a fine nudge.
      if (e.shiftKey) {
        const next = step(at, moments, dir);
        if (next) {
          onScrub(next.at);
          onMoment?.(next);
        }
      } else {
        onScrub(Math.min(to, Math.max(from, at + dir * nudge)));
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      onScrub(from);
    } else if (e.key === "End") {
      e.preventDefault();
      onScrub(to);
    }
  };

  return (
    <div className="scrub">
      {laneCount > 0 ? (
        <div
          className="scrub-lanes"
          style={{ height: laneCount * LANE_HEIGHT }}
        >
          {lanes.map((w) => (
            <span
              key={`${w.kind}-${w.from}-${w.label}`}
              className="scrub-warning"
              data-kind={w.kind}
              title={`${w.label} · ${elapsed(w.from)} to ${elapsed(w.to)}`}
              style={{
                left: `${pct(w.from)}%`,
                width: `${Math.max(0.4, pct(w.to) - pct(w.from))}%`,
                top: w.row * LANE_HEIGHT,
              }}
            />
          ))}
        </div>
      ) : null}

      <div
        className="scrub-track"
        ref={measure}
        style={{ height: STRIP_HEIGHT }}
        role="slider"
        tabIndex={0}
        aria-label="Chase timeline"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={Math.round(at)}
        aria-valuetext={elapsed(at)}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          place(toSeconds(e.clientX));
        }}
        onPointerMove={(e) => {
          setHover(toSeconds(e.clientX));
          if (dragging) place(toSeconds(e.clientX));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => {
          setDragging(false);
          setHover(null);
        }}
      >
        {/* The shape of the day. Height carries intensity; the bars are the
            same hue throughout because this is one measure, not categories. */}
        <svg
          className="scrub-strip"
          viewBox={`0 0 ${bands.length} 100`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {bands.map((b, i) =>
            b.intensity > 0 ? (
              <rect
                key={i}
                x={i}
                y={100 - b.intensity * 100}
                width={1}
                height={b.intensity * 100}
                className="scrub-band"
              />
            ) : null,
          )}
        </svg>

        {/* Detents, so the moments worth catching are visible before you catch them. */}
        <div className="scrub-moments" aria-hidden="true">
          {moments.map((m) => (
            <span
              key={`${m.kind}-${m.at}-${m.label}`}
              className="scrub-moment"
              data-kind={m.kind}
              style={{
                left: `${pct(m.at)}%`,
                background: m.ef ? PAL.ef[m.ef] : undefined,
              }}
              title={m.label}
            />
          ))}
        </div>

        {hover !== null && !dragging ? (
          <span
            className="scrub-hover"
            style={{ left: `${pct(hover)}%` }}
            aria-hidden="true"
          >
            <em>{elapsed(hover)}</em>
          </span>
        ) : null}

        <span
          className="scrub-playhead"
          style={{ left: `${pct(at)}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
