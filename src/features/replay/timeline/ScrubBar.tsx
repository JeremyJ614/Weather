import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
import { clockLabel, clockTicks, ScrubDrag } from "./drag";

export interface TimelineTornado {
  name: string;
  ef: string;
  start: number;
  end: number;
}

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
  /** For clock-time labels. Without them the bar speaks in elapsed time. */
  T0?: number;
  tz?: string;
  /** A drag began / ended — the page pauses playback for the length of it. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  /** The tall timeline: lanes for every tornado, warning and hail report. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  named?: readonly TimelineTornado[];
  hail?: readonly number[];
}

const LANE_HEIGHT = 7;

/**
 * The scrub bar: a strip chart of the day, a warning lane, detents, and a
 * thumb you can take hold of.
 *
 * A plain slider across three hours tells the reader nothing about where the
 * day's weather was, and makes landing on a touchdown a matter of luck. This
 * shows the shape of the day (Z3 #18), what was warned and when (Z1 #09), and
 * catches on the moments worth catching on (Z3 #19).
 *
 * The drag (#2) is the part that has to feel right. The playhead used to be a
 * two-pixel line with nothing to hold, a drag stopped the moment a finger
 * slid off the bar, and every pointer move re-rendered the page. Now there is
 * a thumb, the drag is captured so it follows the finger wherever it goes,
 * seeks are coalesced to one per frame, playback pauses while the thumb is
 * held and resumes when it is let go, and sliding off the bar vertically
 * turns the drag fine — half speed, a fifth, a twentieth — for landing on a
 * single minute.
 */
export function ScrubBar(props: ScrubBarProps) {
  const {
    window: win,
    at,
    onScrub,
    moments = [],
    snapping = true,
    onMoment,
    T0,
    tz,
    expanded = false,
    onToggleExpand,
  } = props;
  const [from, to] = win;
  const span = Math.max(1, to - from);

  /** Where the tall timeline is looking; the whole day until zoomed. */
  const [view, setView] = useState<[number, number]>(win);
  // A new window resets the view, set during render rather than in an effect.
  const [seen, setSeen] = useState(`${from}:${to}`);
  if (seen !== `${from}:${to}`) {
    setSeen(`${from}:${to}`);
    setView(win);
  }

  const place = useCallback(
    (seconds: number, fine: boolean, width: number, viewSpan: number) => {
      if (!snapping || fine) {
        onScrub(seconds);
        onMoment?.(null);
        return;
      }
      // The detent is a fixed distance on screen, converted to seconds, so it
      // feels identical on a phone and on a wide monitor.
      const res = snap(seconds, moments, radiusFor(viewSpan, width));
      onScrub(res.at);
      onMoment?.(res.moment);
    },
    [snapping, onScrub, onMoment, moments],
  );

  const onKey = (e: React.KeyboardEvent) => {
    const nudge = (expanded ? view[1] - view[0] : span) / 200;
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

  const label = (s: number) =>
    T0 !== undefined && tz ? clockLabel(T0 + s, tz) : elapsed(s);

  return (
    <div className="scrub" data-expanded={expanded || undefined}>
      {expanded && (
        <TimelineExpanded
          {...props}
          view={view}
          setView={setView}
          place={place}
          onKey={onKey}
          label={label}
        />
      )}
      <div className="scrub-row">
        <CompactBar
          {...props}
          view={expanded ? view : null}
          place={place}
          onKey={onKey}
          label={label}
        />
        {onToggleExpand && (
          <button
            type="button"
            className="scrub-expand"
            aria-pressed={expanded}
            aria-label={
              expanded ? "Collapse the timeline" : "Expand the timeline"
            }
            title={expanded ? "Collapse the timeline" : "Expand the timeline"}
            onClick={onToggleExpand}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              {expanded ? (
                <path
                  d="M3 10l5-5 5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(180 8 8)"
                />
              ) : (
                <path
                  d="M3 10l5-5 5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the drag, shared by both views
// ---------------------------------------------------------------------------

interface DragState {
  fine: number | null;
  active: boolean;
}

function useScrubDrag(
  el: RefObject<HTMLElement | null>,
  view: [number, number],
  place: (s: number, fine: boolean, width: number, span: number) => void,
  onStart?: () => void,
  onEnd?: () => void,
) {
  const drag = useRef<ScrubDrag | null>(null);
  const pointer = useRef<number | null>(null);
  const pending = useRef<{ s: number; fine: boolean } | null>(null);
  const raf = useRef<number | null>(null);
  const box = useRef<DOMRect | null>(null);
  const [state, setState] = useState<DragState>({ fine: null, active: false });

  const flush = () => {
    raf.current = null;
    const p = pending.current;
    const b = box.current;
    if (!p || !b) return;
    pending.current = null;
    place(p.s, p.fine, b.width, view[1] - view[0]);
  };
  const schedule = (s: number, fine: boolean) => {
    pending.current = { s, fine };
    if (raf.current === null) raf.current = requestAnimationFrame(flush);
  };
  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const end = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      flush();
    }
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    drag.current = null;
    setState({ fine: null, active: false });
    onEnd?.();
  };

  return {
    state,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (pointer.current !== null) return;
        const target = el.current;
        if (!target) return;
        const b = target.getBoundingClientRect();
        if (b.width === 0) return;
        box.current = b;
        pointer.current = e.pointerId;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        drag.current = new ScrubDrag(
          view[0],
          view[1],
          b.width,
          b.top + b.height / 2,
        );
        setState({ fine: 1, active: true });
        onStart?.();
        schedule(drag.current.start(e.clientX, b.left), false);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (pointer.current !== e.pointerId || !drag.current || !box.current)
          return;
        const s = drag.current.move(e.clientX, e.clientY, box.current.left);
        const p = drag.current.precision(e.clientY);
        setState((st) => (st.fine === p ? st : { fine: p, active: true }));
        schedule(s, drag.current.isFine);
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
    },
  };
}

function Thumb({
  pct,
  label,
  active,
  fine,
}: {
  pct: number;
  label: string;
  active: boolean;
  fine: number | null;
}) {
  return (
    <span
      className="scrub-thumb"
      data-active={active || undefined}
      style={{ left: `${pct}%` }}
      aria-hidden="true"
    >
      <span className="scrub-thumb-line" />
      <span className="scrub-thumb-knob" />
      {active && (
        <span className="scrub-bubble">
          {label}
          {fine !== null && fine < 1 && (
            <em>
              {fine === 0.5 ? "half speed" : fine === 0.2 ? "fine" : "finest"}
            </em>
          )}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// the compact bar
// ---------------------------------------------------------------------------

function CompactBar({
  window: win,
  at,
  tornadoes,
  warnings = [],
  moments = [],
  onScrubStart,
  onScrubEnd,
  view,
  place,
  onKey,
  label,
  expanded,
}: ScrubBarProps & {
  view: [number, number] | null;
  place: (s: number, fine: boolean, width: number, span: number) => void;
  onKey: (e: React.KeyboardEvent) => void;
  label: (s: number) => string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [from, to] = win;
  const span = Math.max(1, to - from);
  const bands = useMemo(
    () => stripChart(win, tornadoes, 160),
    [win, tornadoes],
  );
  const lanes = useMemo(() => layoutWarnings(warnings), [warnings]);
  const laneCount = lanes.reduce((n, w) => Math.max(n, w.row + 1), 0);
  const pct = (seconds: number) => ((seconds - from) / span) * 100;
  const { state, handlers } = useScrubDrag(
    ref,
    win,
    place,
    onScrubStart,
    onScrubEnd,
  );

  const toSeconds = (clientX: number): number => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return at;
    return (
      from + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span
    );
  };

  return (
    <div className="scrub-compact">
      {laneCount > 0 && !expanded ? (
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
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Chase timeline"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={Math.round(at)}
        aria-valuetext={label(at)}
        onKeyDown={onKey}
        {...handlers}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") setHover(toSeconds(e.clientX));
          handlers.onPointerMove(e);
        }}
        onPointerLeave={() => setHover(null)}
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

        {/* When the tall timeline is zoomed, what part of the day it is showing. */}
        {view && (view[0] > from || view[1] < to) && (
          <span
            className="scrub-view"
            style={{
              left: `${pct(view[0])}%`,
              width: `${pct(view[1]) - pct(view[0])}%`,
            }}
            aria-hidden="true"
          />
        )}

        {hover !== null && !state.active ? (
          <span
            className="scrub-hover"
            style={{ left: `${pct(hover)}%` }}
            aria-hidden="true"
          >
            <em>{label(hover)}</em>
          </span>
        ) : null}

        <Thumb
          pct={pct(at)}
          label={label(at)}
          active={state.active}
          fine={state.fine}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the tall timeline
// ---------------------------------------------------------------------------

interface Packed<T> {
  item: T;
  row: number;
}

/** Greedy rows: each span goes in the first row it does not overlap. */
function pack<T>(
  items: readonly T[],
  start: (t: T) => number,
  end: (t: T) => number,
  gap: number,
): Packed<T>[] {
  const rows: number[] = [];
  const sorted = [...items].sort((a, b) => start(a) - start(b));
  return sorted.map((item) => {
    let r = rows.findIndex((last) => start(item) >= last + gap);
    if (r < 0) {
      r = rows.length;
      rows.push(end(item));
    } else rows[r] = end(item);
    return { item, row: r };
  });
}

function TimelineExpanded({
  window: win,
  at,
  onScrub,
  warnings = [],
  moments = [],
  named = [],
  hail = [],
  T0,
  tz,
  onScrubStart,
  onScrubEnd,
  view,
  setView,
  place,
  onKey,
  label,
}: ScrubBarProps & {
  view: [number, number];
  setView: (v: [number, number]) => void;
  place: (s: number, fine: boolean, width: number, span: number) => void;
  onKey: (e: React.KeyboardEvent) => void;
  label: (s: number) => string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(600);
  const [from, to] = win;
  const [vf, vt] = view;
  const vspan = Math.max(60, vt - vf);
  const pct = (s: number) => ((s - vf) / vspan) * 100;
  const { state, handlers } = useScrubDrag(
    ref,
    view,
    place,
    onScrubStart,
    onScrubEnd,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /** Zoom by a factor around a moment, kept inside the day. */
  const zoom = useCallback(
    (factor: number, around: number) => {
      const full = to - from;
      const next = Math.min(full, Math.max(120, (vt - vf) * factor));
      let a = around - ((around - vf) / (vt - vf)) * next;
      a = Math.max(from, Math.min(to - next, a));
      setView([a, a + next]);
    },
    [from, to, vf, vt, setView],
  );

  // Keep the playhead in sight while playing through a zoomed view.
  useEffect(() => {
    if (state.active) return;
    if (at < vf || at > vt) {
      const w = vt - vf;
      const a = Math.max(from, Math.min(to - w, at - w * 0.15));
      setView([a, a + w]);
    }
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel zooms (with the trackpad's pinch arriving as ctrl+wheel); plain
  // horizontal wheel pans.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      const b = el.getBoundingClientRect();
      const around = vf + ((e.clientX - b.left) / b.width) * (vt - vf);
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        e.preventDefault();
        const shift = (e.deltaX / b.width) * (vt - vf);
        const w = vt - vf;
        const a = Math.max(from, Math.min(to - w, vf + shift));
        setView([a, a + w]);
        return;
      }
      e.preventDefault();
      zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), around);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [vf, vt, from, to, zoom, setView]);

  const ticks = useMemo(
    () => (T0 !== undefined && tz ? clockTicks(vf, vt, T0, tz, width) : []),
    [vf, vt, T0, tz, width],
  );
  const packedT = useMemo(
    () =>
      pack(
        named,
        (t) => t.start,
        (t) => t.end,
        60,
      ),
    [named],
  );
  const tRows = packedT.reduce((n, p) => Math.max(n, p.row + 1), 0);
  const packedW = useMemo(() => layoutWarnings(warnings), [warnings]);
  const wRows = packedW.reduce((n, w) => Math.max(n, w.row + 1), 0);
  const visible = (a: number, b: number) => b >= vf && a <= vt;
  const zoomed = vf > from || vt < to;

  return (
    <div className="tl">
      <div className="tl-head">
        <span className="tl-title">Timeline</span>
        <span className="tl-range">
          {label(vf)} – {label(vt)}
        </span>
        <span className="tl-grow" />
        <button
          type="button"
          className="tl-btn"
          onClick={() => zoom(0.5, at)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={() => zoom(2, at)}
          aria-label="Zoom out"
          disabled={!zoomed}
        >
          −
        </button>
        <button
          type="button"
          className="tl-btn tl-wide"
          onClick={() => setView([from, to])}
          disabled={!zoomed}
        >
          Whole day
        </button>
      </div>

      <div
        className="tl-body"
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Chase timeline, expanded"
        aria-valuemin={from}
        aria-valuemax={to}
        aria-valuenow={Math.round(at)}
        aria-valuetext={label(at)}
        onKeyDown={onKey}
        {...handlers}
      >
        <div className="tl-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t.at}
              className="tl-tick"
              data-major={t.major || undefined}
              style={{ left: `${pct(t.at)}%` }}
            >
              <em>{t.label}</em>
            </span>
          ))}
        </div>

        {named.length > 0 && (
          <div
            className="tl-lane"
            style={{ height: Math.max(1, tRows) * 22 + 4 }}
          >
            <span className="tl-lane-name">Tornadoes</span>
            {packedT.map(
              ({ item: t, row }) =>
                visible(t.start, t.end) && (
                  <button
                    type="button"
                    key={`${t.name}-${t.start}`}
                    className="tl-bar"
                    tabIndex={-1}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onScrub(t.start)}
                    title={`${t.ef} ${t.name} · ${label(t.start)}–${label(t.end)}`}
                    style={{
                      left: `${Math.max(0, pct(t.start))}%`,
                      width: `${Math.max(0.6, Math.min(100, pct(t.end)) - Math.max(0, pct(t.start)))}%`,
                      top: row * 22 + 2,
                      ["--ef" as string]: PAL.ef[t.ef] ?? PAL.ef.EFU,
                    }}
                  >
                    <span>
                      {t.ef.replace("EF", "")} · {t.name}
                    </span>
                  </button>
                ),
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="tl-lane" style={{ height: wRows * 10 + 4 }}>
            <span className="tl-lane-name">Warnings</span>
            {packedW.map(
              (w) =>
                visible(w.from, w.to) && (
                  <span
                    key={`${w.kind}-${w.from}-${w.label}`}
                    className="tl-warn"
                    data-kind={w.kind}
                    title={`${w.label} · ${label(w.from)}–${label(w.to)}`}
                    style={{
                      left: `${Math.max(0, pct(w.from))}%`,
                      width: `${Math.max(0.4, Math.min(100, pct(w.to)) - Math.max(0, pct(w.from)))}%`,
                      top: w.row * 10 + 2,
                    }}
                  />
                ),
            )}
          </div>
        )}

        {hail.length > 0 && (
          <div className="tl-lane tl-lane-hail">
            <span className="tl-lane-name">Hail</span>
            {hail.map(
              (h, i) =>
                visible(h, h) && (
                  <span
                    key={i}
                    className="tl-hail"
                    style={{ left: `${pct(h)}%` }}
                  />
                ),
            )}
          </div>
        )}

        <div className="tl-lane tl-lane-moments" aria-hidden="true">
          {moments
            .filter(
              (m) =>
                m.kind !== "start" && m.kind !== "end" && visible(m.at, m.at),
            )
            .map((m) => (
              <span
                key={`${m.kind}-${m.at}-${m.label}`}
                className="tl-moment"
                data-kind={m.kind}
                style={{
                  left: `${pct(m.at)}%`,
                  background: m.ef ? PAL.ef[m.ef] : undefined,
                }}
                title={m.label}
              />
            ))}
        </div>

        {at >= vf && at <= vt && (
          <Thumb
            pct={pct(at)}
            label={label(at)}
            active={state.active}
            fine={state.fine}
          />
        )}
      </div>
    </div>
  );
}
