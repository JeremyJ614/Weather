"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTier } from "@/features/motion/useTier";
import s from "./InfoScrub.module.css";

/**
 * Drag-to-read layer for line charts (post-launch B1, after Chris Gannon's interactive SVG
 * info graph). Rendered as the last child of a chart's own <svg>: a glowing handle rides each
 * line, an elastic value bubble follows it on a tether, the stretch of line already passed
 * lights up and a scan beam marks the hour. Everything moves through `transform` and
 * `opacity` (springs in one rAF loop that sleeps when settled); low-tier phones and Reduce
 * Motion get the same readout without the springs. Keyboard: focus, then arrow keys.
 */
export type ScrubSeries = {
  key: string;
  label?: string;
  color: string;
  /** Plotted y (svg units) of each sample; null where the series has no value. */
  y: (number | null)[];
  /** What the bubble says for each sample. */
  text: (string | null)[];
};

export type ScrubProps = {
  series: ScrubSeries[];
  /** svg x of the first and last sample (samples are evenly spaced between them)… */
  x0?: number;
  x1?: number;
  /** …or the svg x of every sample, for uneven spacing (time-stamped snapshots). */
  xs?: number[];
  /** The plot's top and bottom (svg y), for the beam and bubble placement. */
  top: number;
  bottom: number;
  /** The viewBox size, to keep the bubble inside. */
  width: number;
  height: number;
  /** The bubble's heading for sample i (a time, a date). */
  title: (i: number) => string;
  /** Screen-reader name of the chart. */
  label: string;
  /** The sample the handle rests on (default: the first). */
  start?: number;
  /** Bubble text size in svg units (default: width / 38, about 9.5 on a 360-wide chart). */
  font?: number;
  /** Light the line behind the handle while dragging (default true). */
  lit?: boolean;
  /** Called with the sample under the handle as the reader moves it. */
  onIndex?: (i: number) => void;
  /** Extra bubble lines for sample i that have no line of their own (rain chance, flow). */
  rows?: (i: number) => { label: string; text: string; color?: string }[];
};

type Spring = { p: number; v: number };
const sp = (p: number): Spring => ({ p, v: 0 });

export function InfoScrubCore({
  series,
  x0: x0In,
  x1: x1In,
  xs,
  top,
  bottom,
  width,
  height,
  title,
  label,
  start = 0,
  font = width / 38,
  lit = true,
  rows,
  onIndex,
}: ScrubProps) {
  const uid = useId().replace(/:/g, "");
  const tier = useTier();
  const n = Math.max(...series.map((x) => x.y.length), 1);
  const live = series.filter((x) => x.y.some((v) => v != null));
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, start), n - 1));
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);

  const g = useRef<SVGGElement>(null);
  const kickRef = useRef<() => void>(() => {});
  const st = useRef({
    ti: idx,
    ci: idx,
    bx: sp(0),
    by: sp(0),
    sc: sp(0),
    halo: sp(1),
    beam: 0,
    open: false,
    pressed: false,
    raf: 0,
    last: 0,
    placed: false,
  });

  const x0 = xs?.[0] ?? x0In ?? 0;
  const x1 = xs?.[xs.length - 1] ?? x1In ?? width;
  const xAt = (f: number) => {
    if (!xs) return x0 + ((x1 - x0) * f) / Math.max(1, n - 1);
    const a = Math.max(0, Math.min(xs.length - 1, Math.floor(f)));
    const b = Math.min(xs.length - 1, a + 1);
    return xs[a] + (xs[b] - xs[a]) * (f - a);
  };
  const fromX = (px: number) => {
    if (!xs) return ((px - x0) / Math.max(1, x1 - x0)) * (n - 1);
    if (px <= xs[0]) return 0;
    for (let a = 0; a < xs.length - 1; a++)
      if (px <= xs[a + 1])
        return a + (px - xs[a]) / Math.max(1e-6, xs[a + 1] - xs[a]);
    return xs.length - 1;
  };
  const yAt = (se: ScrubSeries, f: number) => {
    const a = Math.floor(f);
    const b = Math.min(n - 1, a + 1);
    const ya = se.y[a];
    const yb = se.y[b];
    if (ya == null && yb == null) return null;
    if (ya == null) return yb;
    if (yb == null) return ya;
    return ya + (yb - ya) * (f - a);
  };

  // Bubble size from its text (svg text can't be measured before it renders).
  type Row = { key: string; label: string; color?: string; t: string };
  const lines: Row[] = [
    ...live.map((se) => ({
      key: se.key,
      label: se.label ?? "",
      color: se.color,
      t: se.text[idx] ?? "–",
    })),
    ...(rows?.(idx) ?? []).map((r, i) => ({
      key: `x${i}`,
      label: r.label,
      color: r.color,
      t: r.text,
    })),
  ];
  const head = title(idx);
  const vf = font * 1.15;
  const hf = font * 0.86;
  const pad = font * 0.9;
  const multi = lines.length > 1;
  const rowW = (l: Row) =>
    (multi ? l.label.length * 0.55 * font + font * 1.6 : 0) +
    l.t.length * 0.6 * vf;
  const bw = Math.max(
    font * 5,
    head.length * 0.55 * hf + pad * 2,
    ...lines.map((l) => rowW(l) + pad * 2),
  );
  const rowH = vf * 1.3;
  const bh = pad * 1.6 + hf + rowH * lines.length;
  const size = useRef({ bw, bh });
  useLayoutEffect(() => {
    size.current = { bw, bh };
    kickRef.current();
  }, [bw, bh]);

  const still = tier === "low";

  useEffect(() => {
    const root = g.current;
    if (!root) return;
    const q = <T extends Element>(sel: string) =>
      root.querySelector(sel) as T | null;
    const dots = [...root.querySelectorAll<SVGGElement>("[data-dot]")];
    const halos = [...root.querySelectorAll<SVGCircleElement>("[data-halo]")];
    const bubble = q<SVGGElement>("[data-bubble]");
    const tether = q<SVGLineElement>("[data-tether]");
    const beam = q<SVGRectElement>("[data-beam]");
    const clip = q<SVGRectElement>("[data-clip]");
    const litG = q<SVGGElement>("[data-lit]");
    const S = st.current;

    const frame = (now: number) => {
      const dt = Math.min(0.05, S.last ? (now - S.last) / 1000 : 0.016);
      S.last = now;
      const k = still ? 1 : Math.min(1, dt * 11);
      S.ci += (S.ti - S.ci) * k;
      if (Math.abs(S.ti - S.ci) < 0.002) S.ci = S.ti;
      const x = xAt(S.ci);
      let minY = Infinity;
      let maxY = -Infinity;
      live.forEach((se, i) => {
        const y = yAt(se, S.ci);
        const d = dots[i];
        if (!d) return;
        if (y == null) {
          d.style.opacity = "0";
          return;
        }
        d.style.opacity = "1";
        d.setAttribute("transform", `translate(${x} ${y})`);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
      if (!isFinite(minY)) minY = maxY = (top + bottom) / 2;
      const { bw, bh } = size.current;
      const gap = font * 2.4;
      // Above the highest dot if it fits, else below the lowest, else beside the beam.
      let mode: "above" | "below" | "right" | "left" = "above";
      let tx = Math.max(2, Math.min(width - bw - 2, x - bw / 2));
      let ty = minY - gap - bh;
      if (ty < 1) {
        mode = "below";
        ty = maxY + gap;
        if (ty + bh > height - 1) {
          mode = x + gap + bw <= width - 2 ? "right" : "left";
          tx = mode === "right" ? x + gap : x - gap - bw;
          ty = Math.max(
            1,
            Math.min(height - bh - 1, (minY + maxY) / 2 - bh / 2),
          );
        }
      }
      const shown = S.open ? 1 : 0;
      const off = shown ? 0 : font * 3;
      const ox = mode === "right" ? -off : mode === "left" ? off : 0;
      const oy = mode === "above" ? off : mode === "below" ? -off : 0;
      if (!S.placed || still) {
        S.bx.p = tx + ox;
        S.by.p = ty + oy;
        S.placed = true;
      }
      const spring = (o: Spring, to: number, kk: number, damp: number) => {
        if (still) {
          o.p = to;
          o.v = 0;
          return;
        }
        o.v += (to - o.p) * kk * dt;
        o.v *= Math.pow(damp, dt * 60);
        o.p += o.v * dt;
      };
      spring(S.bx, tx + ox, 260, 0.8);
      spring(S.by, ty + oy, 260, 0.8);
      spring(S.sc, shown, S.open ? 300 : 500, S.open ? 0.74 : 0.6);
      spring(S.halo, S.pressed ? 2 : 1, 320, 0.72);
      S.beam += ((S.open ? 1 : 0) - S.beam) * (still ? 1 : Math.min(1, dt * 9));
      const sc = Math.max(0, S.sc.p);
      // The bubble pops from the edge that faces the handle.
      const fx = mode === "right" ? 0 : mode === "left" ? bw : bw / 2;
      const fy = mode === "above" ? bh : mode === "below" ? 0 : bh / 2;
      if (bubble) {
        bubble.setAttribute(
          "transform",
          `translate(${S.bx.p + fx} ${S.by.p + fy}) scale(${sc}) translate(${-fx} ${-fy})`,
        );
        bubble.style.opacity = String(Math.min(1, sc * 1.6));
      }
      halos.forEach((h) =>
        h.setAttribute("transform", `scale(${Math.max(0.2, S.halo.p)})`),
      );
      if (tether) {
        const ax = x;
        const ay =
          mode === "above" ? minY : mode === "below" ? maxY : (minY + maxY) / 2;
        const ex = S.bx.p + fx;
        const ey = Math.max(
          S.by.p,
          Math.min(
            S.by.p + bh,
            mode === "above" ? S.by.p + bh : mode === "below" ? S.by.p : ay,
          ),
        );
        const len = Math.max(0.01, Math.hypot(ex - ax, ey - ay));
        const deg = (Math.atan2(ey - ay, ex - ax) * 180) / Math.PI;
        tether.setAttribute(
          "transform",
          `translate(${ax} ${ay}) rotate(${deg}) scale(${len} 1)`,
        );
        tether.style.opacity = String(Math.min(1, sc) * 0.9);
      }
      if (beam) {
        beam.setAttribute("transform", `translate(${x} 0)`);
        beam.style.opacity = String(S.beam * 0.85);
      }
      if (clip) {
        const f = Math.max(0.0001, (x - x0) / Math.max(1, x1 - x0));
        clip.setAttribute("transform", `translate(${x0} 0) scale(${f} 1)`);
      }
      if (litG) litG.style.opacity = String(S.beam);
      const settled =
        S.ci === S.ti &&
        Math.abs(S.bx.v) +
          Math.abs(S.by.v) +
          Math.abs(S.sc.v) +
          Math.abs(S.halo.v) <
          0.01 &&
        Math.abs(S.sc.p - shown) < 0.002 &&
        Math.abs(S.halo.p - (S.pressed ? 2 : 1)) < 0.002 &&
        Math.abs(S.beam - shown) < 0.002;
      S.raf = settled ? 0 : requestAnimationFrame(frame);
      if (settled) S.last = 0;
    };
    const kick = () => {
      if (!S.raf) S.raf = requestAnimationFrame(frame);
    };
    kickRef.current = kick;
    kick();
    return () => {
      cancelAnimationFrame(S.raf);
      S.raf = 0;
    };
    // The springs read the latest geometry through refs; rebuild only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, x0, x1, top, bottom, width, height, still, font]);

  const kick = () => kickRef.current();
  const setTarget = (f: number, snap = false) => {
    const S = st.current;
    const v = Math.max(0, Math.min(n - 1, f));
    S.ti = snap ? Math.round(v) : v;
    const i = Math.round(v);
    if (i !== idx) {
      setIdx(i);
      onIndex?.(i);
    }
    kick();
  };
  const toIndex = (e: React.PointerEvent) => {
    const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement;
    const m = svg?.getScreenCTM();
    if (!m) return st.current.ti;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return fromX(p.x);
  };
  const show = (on: boolean, press = on) => {
    const S = st.current;
    S.open = on;
    S.pressed = press;
    setOpen(on);
    setPressed(press);
    kick();
  };

  // Taps on phones keep the readout open where they land (B4): it closes on a tap outside the
  // chart, and the chart never starts a text selection or the long-press menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!g.current?.contains(e.target as Node)) show(false, false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valueText = useMemo(
    () =>
      `${title(idx)}: ${live
        .map(
          (se) =>
            `${multi && se.label ? se.label + " " : ""}${se.text[idx] ?? "no data"}`,
        )
        .concat((rows?.(idx) ?? []).map((r) => `${r.label} ${r.text}`))
        .join(", ")}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idx, series],
  );

  const pathOf = (se: ScrubSeries) =>
    se.y
      .map((y, i) =>
        y == null ? null : `${xAt(i).toFixed(1)},${y.toFixed(1)}`,
      )
      .filter(Boolean)
      .join(" ");

  return (
    <g ref={g} className={s.root} data-open={open || undefined}>
      <defs>
        <clipPath id={`${uid}-lit`}>
          <rect
            data-clip
            x="0"
            y={top - 20}
            width={Math.max(1, x1 - x0)}
            height={bottom - top + 40}
          />
        </clipPath>
        <linearGradient id={`${uid}-beam`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        data-beam
        className={s.beam}
        x={-font * 1.1}
        y={top}
        width={font * 2.2}
        height={Math.max(1, bottom - top)}
        fill={`url(#${uid}-beam)`}
      />
      {lit && (
        <g data-lit className={s.lit} clipPath={`url(#${uid}-lit)`}>
          {live.map((se) => (
            <polyline
              key={se.key}
              points={pathOf(se)}
              stroke={se.color}
              strokeWidth={font * 0.45}
            />
          ))}
        </g>
      )}
      <line
        data-tether
        className={s.tether}
        x1="0"
        x2="1"
        y1="0"
        y2="0"
        vectorEffect="non-scaling-stroke"
      />
      {live.map((se) => (
        <g key={se.key} data-dot className={s.dot}>
          <circle
            data-halo
            r={font * 1.5}
            className={s.halo}
            style={{ ["--c" as string]: se.color }}
          />
          <circle r={font * 0.62} className={s.core} stroke={se.color} />
        </g>
      ))}
      <g data-bubble className={s.bubble} aria-hidden="true">
        <rect width={bw} height={bh} rx={Math.min(bh / 2, font * 1.6)} />
        <text x={pad} y={pad + hf * 0.9} fontSize={hf} className={s.head}>
          {head}
        </text>
        {lines.map((l, i) => {
          const yy = pad * 1.1 + hf + rowH * (i + 0.8);
          return (
            <g key={l.key}>
              {multi && (
                <>
                  {l.color && (
                    <circle
                      cx={pad + font * 0.35}
                      cy={yy - vf * 0.35}
                      r={font * 0.35}
                      fill={l.color}
                    />
                  )}
                  <text
                    x={pad + (l.color ? font : 0)}
                    y={yy}
                    fontSize={font * 0.9}
                    className={s.name}
                  >
                    {l.label}
                  </text>
                </>
              )}
              <text
                x={bw - pad}
                y={yy}
                fontSize={vf}
                textAnchor="end"
                className={s.value}
              >
                {l.t}
              </text>
            </g>
          );
        })}
      </g>
      <rect
        className={s.hit}
        x={x0 - font}
        y={top - font}
        width={Math.max(1, x1 - x0) + font * 2}
        height={Math.max(1, bottom - top) + font * 2}
        tabIndex={0}
        role="slider"
        aria-label={`${label}: drag or use the arrow keys to read values`}
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={idx}
        aria-valuetext={valueText}
        data-pressed={pressed || undefined}
        onPointerDown={(e) => {
          // A touch press must not start a page text selection.
          if (e.pointerType !== "mouse") e.preventDefault();
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          show(true, true);
          setTarget(toIndex(e));
        }}
        onPointerMove={(e) => {
          if (st.current.pressed || e.pointerType === "mouse") {
            if (!st.current.open) show(true, false);
            setTarget(toIndex(e));
          }
        }}
        onPointerUp={() => {
          setTarget(st.current.ti, true);
          // Stays open where the reader let go; the next tap moves it.
          show(true, false);
        }}
        onPointerCancel={() => show(false, false)}
        onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !st.current.pressed)
            show(false, false);
        }}
        onFocus={() => show(true, false)}
        onBlur={() => show(false, false)}
        onKeyDown={(e) => {
          const step =
            e.key === "ArrowRight" || e.key === "ArrowUp"
              ? 1
              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                ? -1
                : 0;
          if (step) {
            e.preventDefault();
            setTarget(Math.round(st.current.ti) + step, true);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            setTarget(e.key === "Home" ? 0 : n - 1, true);
          }
        }}
      />
    </g>
  );
}
