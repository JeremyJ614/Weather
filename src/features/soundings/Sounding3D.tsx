"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import type { Analysis, Parcel } from "@/lib/soundings/thermo";
import { draw3d } from "./draw3d";

/**
 * The sounding in 3D: the wind at every height as an arrow off a vertical axis, the
 * hodograph traced through the tips, its shadow on the floor, the cloud base (LCL) and
 * the CAPE layer (LFC to EL). Drag to turn and tilt; it turns slowly on its own unless
 * reduced motion is on, the phone is low tier, or it is off screen.
 */
export function Sounding3D({
  a,
  parcel,
  c,
}: {
  a: Analysis;
  parcel: Parcel;
  c: (k: string) => string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ yaw: -0.6, tilt: 0.42, zoom: 1, tx: 0, ty: 0 });
  const scene = useRef({ a, parcel, c });
  const redraw = useRef<() => void>(() => {});
  /** Zoom by `f` about a canvas point (CSS px); the centre when none is given. */
  const zoomBy = useRef<(f: number, mx?: number, my?: number) => void>(
    () => {},
  );

  useEffect(() => {
    scene.current = { a, parcel, c };
    redraw.current();
  }, [a, parcel, c]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      clamp();
      draw();
    };
    // Zoomed like a picture: the scene drawn at 1x, then scaled about (tx, ty), and kept
    // covering the canvas so it can't be lost off an edge.
    const clamp = () => {
      const v = view.current;
      v.zoom = Math.min(5, Math.max(1, v.zoom));
      v.tx = Math.min(0, Math.max(w - w * v.zoom, v.tx));
      v.ty = Math.min(0, Math.max(h - h * v.zoom, v.ty));
    };
    const zoomAt = (z: number, mx: number, my: number) => {
      const v = view.current;
      const px = (mx - v.tx) / v.zoom;
      const py = (my - v.ty) / v.zoom;
      v.zoom = Math.min(5, Math.max(1, z));
      v.tx = mx - px * v.zoom;
      v.ty = my - py * v.zoom;
      clamp();
      draw();
    };
    zoomBy.current = (f, mx = w / 2, my = h / 2) => {
      touched = true;
      if (f === 0) {
        Object.assign(view.current, { zoom: 1, tx: 0, ty: 0 });
        draw();
      } else zoomAt(view.current.zoom * f, mx, my);
    };

    function draw() {
      if (!ctx || !w) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const v = view.current;
      ctx.setTransform(
        dpr * v.zoom,
        0,
        0,
        dpr * v.zoom,
        dpr * v.tx,
        dpr * v.ty,
      );
      draw3d(ctx, w, h, scene.current, v);
    }
    redraw.current = draw;

    const ro = new ResizeObserver(size);
    ro.observe(cv);

    // One finger (or the mouse) turns (x) and tilts (y); two fingers pinch to zoom and
    // move the zoomed view; the wheel zooms at the pointer; a double tap zooms in or resets.
    let drag: { x: number; y: number } | null = null;
    let touched = false;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: {
      d: number;
      mx: number;
      my: number;
      z: number;
      tx: number;
      ty: number;
    } | null = null;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const two = () => {
      const [a, b] = [...pts.values()];
      return {
        d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
      };
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, local(e));
      touched = true;
      cv.setPointerCapture(e.pointerId);
      if (pts.size === 2) {
        const v = view.current;
        pinch = { ...two(), z: v.zoom, tx: v.tx, ty: v.ty };
        drag = null;
      } else if (pts.size === 1) drag = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      if (pinch && pts.size >= 2) {
        const now = two();
        const v = view.current;
        const px = (pinch.mx - pinch.tx) / pinch.z;
        const py = (pinch.my - pinch.ty) / pinch.z;
        v.zoom = Math.min(5, Math.max(1, pinch.z * (now.d / pinch.d)));
        v.tx = now.mx - px * v.zoom;
        v.ty = now.my - py * v.zoom;
        clamp();
        draw();
        return;
      }
      if (!drag) return;
      view.current.yaw += (e.clientX - drag.x) * 0.01;
      view.current.tilt = Math.max(
        0.12,
        Math.min(1.25, view.current.tilt + (e.clientY - drag.y) * 0.006),
      );
      drag = { x: e.clientX, y: e.clientY };
      draw();
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      touched = true;
      const p = local(e);
      zoomAt(view.current.zoom * Math.exp(-e.deltaY * 0.002), p.x, p.y);
    };
    const dbl = (e: MouseEvent) => {
      const p = local(e);
      zoomBy.current(view.current.zoom > 1.05 ? 0 : 2.5, p.x, p.y);
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    cv.addEventListener("dblclick", dbl);

    // Slow turn while visible, unless the viewer prefers stillness or the phone is low tier.
    const still =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.tier === "low";
    let raf = 0;
    let seen = false;
    let last = 0;
    const tick = (t: number) => {
      if (last && !drag && !touched) {
        view.current.yaw += ((t - last) / 1000) * 0.25;
        draw();
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      cancelAnimationFrame(raf);
      last = 0;
      if (seen && !still) raf = requestAnimationFrame(tick);
    });
    io.observe(cv);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("wheel", wheel);
      cv.removeEventListener("dblclick", dbl);
    };
  }, []);

  const key =
    "grid size-9 place-items-center rounded-xl border border-line bg-bg/80 text-text backdrop-blur";
  return (
    <div className="relative">
      <canvas
        ref={ref}
        className="h-[380px] w-full touch-none cursor-grab rounded-2xl"
        role="img"
        aria-label="3D wind profile: drag to turn, pinch or scroll to zoom"
      />
      <div className="absolute right-2 top-2 grid gap-1.5">
        {(
          [
            ["Zoom in", Plus, 1.5],
            ["Zoom out", Minus, 1 / 1.5],
            ["Reset the view", Scan, 0],
          ] as const
        ).map(([label, Icon, f]) => (
          <button
            key={label}
            type="button"
            className={key}
            aria-label={label}
            onClick={() => zoomBy.current(f)}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
