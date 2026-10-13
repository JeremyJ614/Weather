"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type View = { x: number; y: number; w: number };
type Pt = { x: number; y: number };

function clamp(v: View, w: number, h: number): View {
  const vw = Math.min(w, Math.max(w / 10, v.w));
  const vh = (vw * h) / w;
  return {
    w: vw,
    x: Math.min(w - vw, Math.max(0, v.x)),
    y: Math.min(h - vh, Math.max(0, v.y)),
  };
}

/** Zooms by `f` (<1 zooms in) keeping canvas point `at` fixed. */
function zoomView(
  v: View,
  f: number,
  at: Pt | undefined,
  w: number,
  h: number,
) {
  const c = at ?? { x: v.x + v.w / 2, y: v.y + (v.w * h) / w / 2 };
  const nw = Math.min(w, Math.max(w / 10, v.w * f));
  const k = nw / v.w;
  return clamp(
    { w: nw, x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k },
    w,
    h,
  );
}

/**
 * Pan and pinch-zoom for a fixed-aspect SVG canvas (w×h). Off until `live`;
 * a press that barely moves still counts as a tap (`onTap` in canvas units).
 */
export function useZoom(
  svg: RefObject<SVGSVGElement | null>,
  w: number,
  h: number,
  live: boolean,
  onTap?: (x: number, y: number) => void,
) {
  const [view, setView] = useState<View>({ x: 0, y: 0, w });
  const ptrs = useRef(new Map<number, Pt>());
  const travel = useRef(0);
  const pinch = useRef(0);

  /** Canvas point under a screen point, for the current view. */
  const toCanvas = (cx: number, cy: number): Pt | null => {
    const m = svg.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const zoomAt = (f: number, at?: Pt) =>
    setView((v) => zoomView(v, f, at, w, h));

  useEffect(() => {
    const el = svg.current;
    if (!el || !live) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = el.getScreenCTM();
      const at = m
        ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
        : undefined;
      const f = Math.exp(e.deltaY * 0.0015);
      setView((v) => zoomView(v, f, at, w, h));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [svg, live, w, h]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!live) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.current.size === 1) travel.current = 0;
      pinch.current = 0;
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const prev = ptrs.current.get(e.pointerId);
      if (!live || !prev) return;
      const rect = e.currentTarget.getBoundingClientRect();
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...ptrs.current.values()];
      if (pts.length === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        travel.current += Math.abs(dx) + Math.abs(dy);
        setView((v) => {
          const k = v.w / rect.width;
          return clamp({ ...v, x: v.x - dx * k, y: v.y - dy * k }, w, h);
        });
      } else if (pts.length === 2) {
        travel.current = 99;
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = toCanvas(
          (pts[0].x + pts[1].x) / 2,
          (pts[0].y + pts[1].y) / 2,
        );
        if (pinch.current && mid) zoomAt(pinch.current / d, mid);
        pinch.current = d;
      }
    },
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
      if (!live) return;
      const was = ptrs.current.size;
      ptrs.current.delete(e.pointerId);
      pinch.current = 0;
      if (was === 1 && travel.current < 8 && onTap) {
        const p = toCanvas(e.clientX, e.clientY);
        if (p) onTap(p.x, p.y);
      }
    },
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => {
      ptrs.current.delete(e.pointerId);
      pinch.current = 0;
    },
  };

  return {
    view,
    handlers,
    zoomIn: () => zoomAt(0.6),
    zoomOut: () => zoomAt(1 / 0.6),
    reset: () => setView({ x: 0, y: 0, w }),
    zoomed: view.w < w - 0.5,
  };
}
