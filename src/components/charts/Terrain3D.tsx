"use client";

/**
 * Terrain3D (owner's list #41): a grid of values as 3D columns you can turn, tilt and tap, in
 * the manner of Kokonut UI's Activity Terrain (MIT, @dorianbaffier), redrawn in our look: a
 * dark plate, columns lit in their series color with brighter tops, the picked hour lifted
 * and outlined, the readout above the chart, and a Flat view that becomes a heat map. Drawn on
 * one canvas only while something moves (springs settle and the loop stops), paused off
 * screen, at most 2× pixels; Reduce Motion and low-tier phones get the still view.
 * Phones (owner's list #42): one finger turns, two fingers pinch to zoom, twist to turn and move
 * up or down to tilt; zoomed in, one finger pans; a double tap or Reset brings the view back.
 * Buttons under the chart turn, tilt and zoom too; Ctrl or ⌘ with the wheel zooms on computers.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import s from "./Terrain3D.module.css";

export type TerrainRow = { label: string; color: string };
export type TerrainCol = {
  /** Shown in the readout. */
  label: string;
  /** Shown under the grid (every few columns). */
  tick?: string;
  /** Night or past: the plate is darker under it. */
  dim?: boolean;
};
export type TerrainProps = {
  rows: TerrainRow[];
  cols: TerrainCol[];
  /** values[row][col]; null is no data. */
  values: (number | null)[][];
  /** Each row on its own scale (mixed units) or one scale for all. */
  scale?: "row" | "all";
  /** A fixed top for scale "all". */
  max?: number;
  /** A cell's color (by its value, say); the row's color otherwise. */
  cellColor?: (row: number, col: number, v: number) => string;
  /** The readout's lines for a column. */
  readout: (col: number) => { label: string; text: string; color: string }[];
  /** Level lines across the grid (scale "all"): flood stages, thresholds. */
  planes?: { at: number; color: string; label: string }[];
  label: string;
  height?: number;
  start?: number;
  onSelect?: (col: number) => void;
  defaultFlat?: boolean;
};

const GAP = 0.2;
const DEG = Math.PI / 180;
const PITCH = 52 * DEG;
const YAW = 16 * DEG;
const YAW_LIMIT = 85 * DEG;
const ZOOM_MAX = 4;
const ZK = 220;
const PITCH_LIMIT = 70 * DEG;
const SPIN_HALF = 0.16;
const STIFF = 140;
const DAMP = 2 * Math.sqrt(STIFF);
const EDGE = 180;
const BUMP_K = 400;
const BUMP_D = 2 * Math.sqrt(BUMP_K) * 0.7;
const BUMP = 0.5;
const WAVE = 0.7;
const PAD = 26;
const REST = 0.0005;

type Rgb = [number, number, number];
type Pose = { yaw: number; pitch: number; k: number; cx: number; cy: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const back = (t: number) => {
  const c = 1.4;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

// Any CSS color to RGB, through a 1×1 canvas (hex, rgb(), hsl() all work).
let probe: CanvasRenderingContext2D | null = null;
const rgbCache = new Map<string, Rgb>();
function rgb(color: string): Rgb {
  const hit = rgbCache.get(color);
  if (hit) return hit;
  probe ??= document.createElement("canvas").getContext("2d");
  let out: Rgb = [160, 170, 190];
  if (probe) {
    probe.fillStyle = "#000";
    probe.fillStyle = color;
    const v = String(probe.fillStyle);
    const m = /^#([0-9a-f]{6})/i.exec(v);
    if (m) {
      const n = parseInt(m[1], 16);
      out = [n >> 16, (n >> 8) & 255, n & 255];
    } else {
      const r = /(\d+)\D+(\d+)\D+(\d+)/.exec(v);
      if (r) out = [Number(r[1]), Number(r[2]), Number(r[3])];
    }
  }
  rgbCache.set(color, out);
  return out;
}
const shade = ([r, g, b]: Rgb, k: number, a = 1) =>
  `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${a})`;

function project(p: Pose, x: number, y: number, z: number): [number, number] {
  const c = Math.cos(p.yaw);
  const sn = Math.sin(p.yaw);
  const xr = x * c - z * sn;
  const zr = x * sn + z * c;
  return [
    p.cx + xr * p.k,
    p.cy + (zr * Math.cos(p.pitch) - y * Math.sin(p.pitch)) * p.k,
  ];
}

function poly(g: CanvasRenderingContext2D, pts: [number, number][]) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

function inside(pts: [number, number][], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
}

export function Terrain3D(props: TerrainProps) {
  const {
    rows,
    cols,
    values,
    scale = "all",
    max,
    cellColor,
    readout,
    planes,
    label,
    height = 280,
    start,
    onSelect,
    defaultFlat = false,
  } = props;
  const R = rows.length;
  const C = cols.length;
  const [flat, setFlat] = useState(defaultFlat);
  const [sel, setSel] = useState(clamp(start ?? 0, 0, Math.max(0, C - 1)));
  // Few rows over many hours would be a thin strip: each row gets depth, and the columns height,
  // so the board reads as terrain.
  const DZ = clamp((C * 0.32) / Math.max(1, R), 1, 4);
  const Z = R * DZ;
  const maxH = clamp(C * 0.2, 3.2, 9);

  // Heights (0..1) per cell.
  const norm = useMemo(() => {
    const top =
      scale === "all"
        ? Math.max(
            1e-9,
            max ?? Math.max(0, ...values.flat().map((v) => v ?? 0)),
          )
        : 0;
    return values.map((row) => {
      const m =
        scale === "row" ? Math.max(1e-9, ...row.map((v) => v ?? 0)) : top;
      return row.map((v) => (v == null ? -1 : clamp(v / m, 0, 1)));
    });
  }, [values, scale, max]);
  const planeH = useMemo(() => {
    if (!planes || scale !== "all") return [];
    const top = Math.max(
      1e-9,
      max ?? Math.max(0, ...values.flat().map((v) => v ?? 0)),
    );
    return planes
      .filter((p) => p.at <= top * 1.05)
      .map((p) => ({ ...p, h: (p.at / top) * maxH }));
  }, [planes, scale, max, values, maxH]);

  const cv = useRef<HTMLCanvasElement>(null);
  const sim = useRef({
    yaw: 0,
    vyaw: 0,
    pitch: 0,
    vpitch: 0,
    target: defaultFlat ? 0 : PITCH,
    bumps: new Float64Array(C),
    vb: new Float64Array(C),
    hover: -1,
    origin: 0,
    zoom: 1,
    vzoom: 0,
    ztarget: 1,
    panX: 0,
    panY: 0,
    pts: new Map<number, { x: number; y: number }>(),
    pinch: null as null | {
      d0: number;
      a0: number;
      mx: number;
      my: number;
      z0: number;
      yaw0: number;
      pitch0: number;
    },
    tap: { t: 0, x: 0, y: 0 },
    w: 0,
    h: 0,
    dpr: 1,
    drag: null as null | {
      x: number;
      y: number;
      yaw: number;
      pitch: number;
      moved: boolean;
      t: number;
      vx: number;
      px: number;
      py: number;
    },
    raf: 0,
    last: 0,
    visible: false,
    started: false,
    still: false,
    ink: {
      text: "#9aa0b8",
      line: "#2a2a36",
      plate: "#0f1220",
      accent: "#d9b76f",
    },
  });
  useEffect(() => {
    if (sim.current.bumps.length !== C) {
      sim.current.bumps = new Float64Array(C);
      sim.current.vb = new Float64Array(C);
    }
  }, [C]);
  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);
  const tickRef = useRef<(now: number) => void>(() => {});
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});

  const pose = useCallback((): Pose & { lift: number } => {
    const S = sim.current;
    const lift = clamp(S.pitch / PITCH, 0, 1.2);
    const pr: Pose = { yaw: S.yaw, pitch: S.pitch, k: 1, cx: 0, cy: 0 };
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const [x, z] of [
      [0, 0],
      [C, 0],
      [0, Z],
      [C, Z],
    ])
      for (const y of [0, maxH * Math.min(lift, 1)]) {
        const [px, py] = project(pr, x - C / 2, y, z - Z / 2);
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    const k =
      Math.min(
        (S.w - PAD * 2) / (x1 - x0),
        (S.h - PAD * 2 - 18) / (y1 - y0 || 1),
      ) * S.zoom;
    return {
      yaw: S.yaw,
      pitch: S.pitch,
      k,
      cx: S.w / 2 - ((x0 + x1) / 2) * k + S.panX,
      cy: S.h / 2 - ((y0 + y1) / 2) * k - 6 + S.panY,
      lift,
    };
  }, [C, Z, maxH]);

  const colH = useCallback(
    (c: number, r: number, lift: number) => {
      const S = sim.current;
      const n = norm[r]?.[c] ?? -1;
      if (n < 0) return -1;
      const d = Math.abs(c - S.origin) / Math.max(1, C);
      const local = clamp(lift * (1 + WAVE) - d * WAVE, 0, 1);
      return (0.04 + n * maxH) * back(local) + S.bumps[c];
    },
    [norm, C, maxH],
  );

  const order = useCallback(
    (p: Pose) => {
      const sn = Math.sin(p.yaw);
      const cs = Math.cos(p.yaw);
      const cells: { c: number; r: number; d: number }[] = [];
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++)
          cells.push({
            c,
            r,
            d: (c + 0.5 - C / 2) * sn + ((r + 0.5) * DZ - Z / 2) * cs,
          });
      return cells.sort((a, b) => a.d - b.d);
    },
    [R, C, DZ, Z],
  );

  const faces = useCallback(
    (p: Pose, x0: number, z0: number, h: number) => {
      const x1 = x0 + 1 - GAP;
      const z1 = z0 + DZ - GAP;
      const P = (x: number, y: number, z: number) => project(p, x, y, z);
      const out: { pts: [number, number][]; tone: number }[] = [];
      const sn = Math.sin(p.yaw);
      const cs = Math.cos(p.yaw);
      if (h > 0.02 && p.pitch > 0.01) {
        out.push(
          cs > 0
            ? {
                pts: [P(x0, 0, z1), P(x1, 0, z1), P(x1, h, z1), P(x0, h, z1)],
                tone: 0.62,
              }
            : {
                pts: [P(x0, 0, z0), P(x1, 0, z0), P(x1, h, z0), P(x0, h, z0)],
                tone: 0.62,
              },
        );
        if (sn > 0.001)
          out.push({
            pts: [P(x1, 0, z0), P(x1, 0, z1), P(x1, h, z1), P(x1, h, z0)],
            tone: 0.45,
          });
        else if (sn < -0.001)
          out.push({
            pts: [P(x0, 0, z0), P(x0, 0, z1), P(x0, h, z1), P(x0, h, z0)],
            tone: 0.45,
          });
      }
      out.push({
        pts: [P(x0, h, z0), P(x1, h, z0), P(x1, h, z1), P(x0, h, z1)],
        tone: 1,
      });
      return out;
    },
    [DZ],
  );

  const draw = useCallback(() => {
    const S = sim.current;
    const c = cv.current;
    const g = c?.getContext("2d");
    if (!c || !g || !S.w) return;
    const p = pose();
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    g.clearRect(0, 0, S.w, S.h);
    // The plate, with darker strips under dim columns (night, past).
    const P = (x: number, z: number) => project(p, x - C / 2, 0, z - Z / 2);
    poly(g, [
      P(-0.3, -0.3),
      P(C + 0.1, -0.3),
      P(C + 0.1, Z + 0.1),
      P(-0.3, Z + 0.1),
    ]);
    g.fillStyle = S.ink.plate;
    g.fill();
    cols.forEach((col, i) => {
      if (!col.dim) return;
      poly(g, [
        P(i - GAP / 2, -0.3),
        P(i + 1 - GAP / 2, -0.3),
        P(i + 1 - GAP / 2, Z + 0.1),
        P(i - GAP / 2, Z + 0.1),
      ]);
      g.fillStyle = "rgba(10,14,40,0.55)";
      g.fill();
    });
    // Ticks along the front edge and row names along the left (they fade as it rises).
    g.font = `600 10px ${getComputedStyle(c).fontFamily}`;
    g.fillStyle = S.ink.text;
    g.textAlign = "center";
    g.textBaseline = "top";
    cols.forEach((col, i) => {
      if (!col.tick) return;
      const [x, y] = P(i + 0.4, Z + 0.35);
      g.fillText(col.tick, x, y);
    });
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.globalAlpha = clamp(1.1 - p.lift * 0.6, 0.35, 1);
    rows.forEach((row, r) => {
      const [x, y] = P(-0.5, r * DZ + DZ * 0.45);
      g.fillStyle = row.color;
      g.fillText(row.label, x, y);
    });
    g.globalAlpha = 1;
    const selC = selRef.current;
    g.lineJoin = "round";
    for (const cell of order(p)) {
      const h = colH(cell.c, cell.r, p.lift);
      if (h < 0) continue;
      const v = values[cell.r][cell.c] ?? 0;
      const base = rgb(
        cellColor ? cellColor(cell.r, cell.c, v) : rows[cell.r].color,
      );
      const on = cell.c === selC;
      const flatMode = p.lift < 0.15;
      for (const f of faces(p, cell.c - C / 2, cell.r * DZ - Z / 2, h)) {
        poly(g, f.pts);
        // Flat view is a heat map: the value sets how strong the color is.
        const a =
          flatMode && f.tone === 1
            ? 0.25 + 0.75 * (norm[cell.r][cell.c] ?? 0)
            : 1;
        const fill = shade(base, f.tone * (on ? 1.15 : 1), a);
        g.fillStyle = fill;
        g.fill();
        g.strokeStyle = fill;
        g.lineWidth = 0.6;
        g.stroke();
        if (on && f.tone === 1) {
          g.strokeStyle = "rgba(255,255,255,0.95)";
          g.lineWidth = 1.4;
          g.stroke();
        }
      }
    }
    // Level lines (flood stages, thresholds) around the grid's edge at their height; their
    // names sit at the right end, nudged apart so close stages don't overlap.
    const tags: { x: number; y: number; text: string; color: string }[] = [];
    for (const pl of planeH) {
      const h = pl.h * Math.min(p.lift, 1);
      if (h <= 0.02) continue;
      const Q = (x: number, z: number) => project(p, x - C / 2, h, z - Z / 2);
      g.setLineDash([6, 5]);
      g.strokeStyle = pl.color;
      g.lineWidth = 1.5;
      poly(g, [
        Q(-0.3, -0.3),
        Q(C + 0.1, -0.3),
        Q(C + 0.1, Z + 0.1),
        Q(-0.3, Z + 0.1),
      ]);
      g.stroke();
      g.setLineDash([]);
      const [lx, ly] = Q(C + 0.1, -0.3);
      tags.push({ x: lx, y: ly - 3, text: pl.label, color: pl.color });
    }
    tags.sort((m, n) => n.y - m.y);
    for (let k = 1; k < tags.length; k++)
      if (tags[k - 1].y - tags[k].y < 12) tags[k].y = tags[k - 1].y - 12;
    g.textAlign = "right";
    g.textBaseline = "bottom";
    for (const t of tags) {
      g.lineWidth = 3;
      g.strokeStyle = "rgba(8,10,18,0.85)";
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
    }
  }, [
    C,
    Z,
    DZ,
    faces,
    cols,
    rows,
    values,
    norm,
    cellColor,
    planeH,
    colH,
    order,
    pose,
  ]);

  const hit = useCallback(
    (x: number, y: number) => {
      const p = pose();
      const list = order(p);
      for (let i = list.length - 1; i >= 0; i--) {
        const cell = list[i];
        const h = colH(cell.c, cell.r, p.lift);
        if (h < 0) continue;
        for (const f of faces(p, cell.c - C / 2, cell.r * DZ - Z / 2, h))
          if (inside(f.pts, x, y)) return cell.c;
      }
      return -1;
    },
    [pose, order, colH, faces, C, DZ, Z],
  );

  const step = useCallback((dt: number) => {
    const S = sim.current;
    let e = 0;
    if (!S.drag) {
      S.vyaw *= 0.5 ** (dt / SPIN_HALF);
      let t = S.yaw;
      if (S.target === 0) t = 0;
      else if (S.yaw > YAW_LIMIT) t = YAW_LIMIT;
      else if (S.yaw < -YAW_LIMIT) t = -YAW_LIMIT;
      if (t !== S.yaw)
        S.vyaw += ((t - S.yaw) * EDGE - S.vyaw * 2 * Math.sqrt(EDGE)) * dt;
      S.yaw += S.vyaw * dt;
      e = Math.max(e, Math.abs(S.vyaw), Math.abs(t - S.yaw));
      S.vpitch += ((S.target - S.pitch) * STIFF - S.vpitch * DAMP) * dt;
      S.pitch += S.vpitch * dt;
      e = Math.max(e, Math.abs(S.vpitch), Math.abs(S.target - S.pitch));
    }
    if (!S.pinch) {
      S.vzoom += ((S.ztarget - S.zoom) * ZK - S.vzoom * 2 * Math.sqrt(ZK)) * dt;
      S.zoom = clamp(S.zoom + S.vzoom * dt, 0.9, ZOOM_MAX * 1.05);
      e = Math.max(e, Math.abs(S.vzoom) * 0.1, Math.abs(S.ztarget - S.zoom));
      // Pan stays where the zoomed board can be seen, and returns home at full size.
      const lx = Math.max(0, S.zoom - 1) * S.w * 0.6,
        ly = Math.max(0, S.zoom - 1) * S.h * 0.6;
      const tx = clamp(S.panX, -lx, lx),
        ty = clamp(S.panY, -ly, ly);
      if (!S.drag) {
        S.panX += (tx - S.panX) * Math.min(1, dt * 14);
        S.panY += (ty - S.panY) * Math.min(1, dt * 14);
        e = Math.max(
          e,
          Math.abs(tx - S.panX) * 0.01,
          Math.abs(ty - S.panY) * 0.01,
        );
      }
    }
    for (let i = 0; i < S.bumps.length; i++) {
      const t =
        (i === S.hover || i === selRef.current) && S.pitch > 0.1 ? BUMP : 0;
      S.vb[i] += ((t - S.bumps[i]) * BUMP_K - S.vb[i] * BUMP_D) * dt;
      S.bumps[i] += S.vb[i] * dt;
      e = Math.max(e, Math.abs(S.vb[i]) * 0.1, Math.abs(t - S.bumps[i]));
    }
    return e;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const S = sim.current;
      S.raf = 0;
      const dt = S.last ? Math.min((now - S.last) / 1000, 1 / 30) : 1 / 60;
      S.last = now;
      const e = step(dt);
      draw();
      if ((S.drag || e > REST) && S.visible)
        S.raf = requestAnimationFrame((t) => tickRef.current(t));
      else S.last = 0;
    },
    [draw, step],
  );
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const wake = useCallback(() => {
    const S = sim.current;
    if (S.still) {
      S.pitch = S.target;
      S.yaw = S.target ? YAW : 0;
      S.vpitch = S.vyaw = 0;
      S.bumps.fill(0);
      draw();
      return;
    }
    if (!S.raf && S.visible) S.raf = requestAnimationFrame(tick);
  }, [draw, tick]);

  useEffect(() => {
    const S = sim.current;
    const c = cv.current;
    if (!c) return;
    S.still =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.tier === "low";
    const css = getComputedStyle(document.documentElement);
    const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
    S.ink = {
      text: v("--muted", "#9aa0b8"),
      line: v("--line", "#2a2a36"),
      plate: "rgba(255,255,255,0.035)",
      accent: v("--accent", "#d9b76f"),
    };
    const ro = new ResizeObserver(([en]) => {
      S.w = en.contentRect.width;
      S.h = en.contentRect.height;
      S.dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(S.w * S.dpr);
      c.height = Math.round(S.h * S.dpr);
      draw();
    });
    ro.observe(c);
    let on = false;
    const upd = () => {
      S.visible = on && !document.hidden;
      if (S.visible) {
        if (!S.started) {
          S.started = true;
          if (S.target > 0) S.vyaw = (YAW * Math.LN2) / SPIN_HALF;
        }
        wake();
      } else if (S.raf) {
        cancelAnimationFrame(S.raf);
        S.raf = 0;
        S.last = 0;
      }
    };
    const io = new IntersectionObserver(([en]) => {
      on = en.isIntersecting;
      upd();
    });
    io.observe(c);
    document.addEventListener("visibilitychange", upd);
    // Two fingers (or one while zoomed in) belong to the chart, not to page scrolling or zoom.
    const tm = (e: TouchEvent) => {
      if (e.touches.length > 1 || S.ztarget > 1.02) e.preventDefault();
    };
    const wh = (e: WheelEvent) => wheelRef.current(e);
    c.addEventListener("touchmove", tm, { passive: false });
    c.addEventListener("wheel", wh, { passive: false });
    return () => {
      ro.disconnect();
      io.disconnect();
      c.removeEventListener("touchmove", tm);
      c.removeEventListener("wheel", wh);
      document.removeEventListener("visibilitychange", upd);
      cancelAnimationFrame(S.raf);
      S.raf = 0;
    };
  }, [draw, wake]);

  // New data: rise again from the selected hour.
  useEffect(() => {
    sim.current.origin = selRef.current;
    wake();
  }, [values, wake]);

  const pick = (c: number) => {
    if (c < 0 || c >= C) return;
    setSel(c);
    selRef.current = c;
    onSelect?.(c);
    wake();
  };
  const local = (e: PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const [zoomed, setZoomed] = useState(false);
  const syncZoom = () => setZoomed(sim.current.ztarget > 1.02);
  /** Zoom to z1 keeping the screen point (sx, sy) still. */
  const zoomAt = (sx: number, sy: number, z1: number, now = false) => {
    const S = sim.current;
    z1 = clamp(z1, 1, ZOOM_MAX);
    const z0 = now ? S.zoom : S.ztarget;
    const ax = S.w / 2 + S.panX,
      ay = S.h / 2 - 6 + S.panY;
    S.panX = sx - (sx - ax) * (z1 / z0) - S.w / 2;
    S.panY = sy - (sy - ay) * (z1 / z0) - (S.h / 2 - 6);
    S.ztarget = z1;
    if (now) {
      S.zoom = z1;
      S.vzoom = 0;
    }
  };
  const turnBy = (d: number) => {
    const S = sim.current;
    if (S.target === 0) setView(false);
    S.vyaw += (d * Math.LN2) / SPIN_HALF;
    wake();
  };
  const tiltBy = (d: number) => {
    const S = sim.current;
    S.target = clamp((S.target || 0) + d, 0, PITCH_LIMIT);
    if (S.target < 8 * DEG) S.target = 0;
    setFlat(S.target === 0);
    wake();
  };
  const zoomBy = (f: number) => {
    const S = sim.current;
    zoomAt(S.w / 2, S.h / 2, S.ztarget * f);
    syncZoom();
    wake();
  };
  const reset = () => {
    const S = sim.current;
    S.ztarget = 1;
    S.panX = S.panY = 0;
    S.vyaw = ((YAW - S.yaw) * Math.LN2) / SPIN_HALF;
    S.target = PITCH;
    setFlat(false);
    syncZoom();
    wake();
  };
  const startPinch = () => {
    const S = sim.current;
    const [a, b] = [...S.pts.values()];
    S.drag = null;
    S.pinch = {
      d0: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)),
      a0: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      z0: S.zoom,
      yaw0: S.yaw,
      pitch0: S.pitch,
    };
    S.vyaw = S.vzoom = 0;
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    const S = sim.current;
    const { x, y } = local(e);
    S.pts.set(e.pointerId, { x, y });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (S.pts.size === 2) startPinch();
    else if (S.pts.size === 1)
      S.drag = {
        x,
        y,
        yaw: S.yaw,
        pitch: S.pitch,
        moved: false,
        t: performance.now(),
        vx: 0,
        px: S.panX,
        py: S.panY,
      };
    wake();
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const S = sim.current;
    const { x, y } = local(e);
    if (S.pts.has(e.pointerId)) S.pts.set(e.pointerId, { x, y });
    if (S.pinch && S.pts.size >= 2) {
      const [a, b] = [...S.pts.values()];
      const P = S.pinch;
      const d = Math.max(10, Math.hypot(b.x - a.x, b.y - a.y));
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      // Pinch zooms about the fingers, a twist turns, both fingers up or down tilt.
      zoomAt(mx, my, P.z0 * (d / P.d0), true);
      let da = Math.atan2(b.y - a.y, b.x - a.x) - P.a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      S.yaw = clamp(P.yaw0 + da, -YAW_LIMIT * 1.1, YAW_LIMIT * 1.1);
      S.pitch = clamp(P.pitch0 - (my - P.my) * 0.36 * DEG, 0, PITCH_LIMIT);
      draw();
      return;
    }
    if (S.drag) {
      const dx = x - S.drag.x;
      const dy = y - S.drag.y;
      if (!S.drag.moved && Math.hypot(dx, dy) < 6) return;
      S.drag.moved = true;
      if (e.pointerType !== "mouse" && S.ztarget > 1.02) {
        // Zoomed in: one finger moves around the board.
        S.panX = S.drag.px + dx;
        S.panY = S.drag.py + dy;
        draw();
        return;
      }
      const now = performance.now();
      const ny = clamp(
        S.drag.yaw + dx * 0.32 * DEG,
        -YAW_LIMIT * 1.1,
        YAW_LIMIT * 1.1,
      );
      S.drag.vx = (ny - S.yaw) / Math.max(0.008, (now - S.drag.t) / 1000);
      S.drag.t = now;
      S.yaw = ny;
      S.pitch = clamp(S.drag.pitch - dy * 0.36 * DEG, 0, PITCH_LIMIT);
      S.target = S.pitch < 8 * DEG ? 0 : S.pitch;
      if ((S.target === 0) !== flat) setFlat(S.target === 0);
      draw();
      return;
    }
    if (e.pointerType === "mouse") {
      const c = hit(x, y);
      if (c !== S.hover) {
        S.hover = c;
        wake();
      }
    }
  };
  const up = (e: PointerEvent<HTMLCanvasElement>, cancel = false) => {
    const S = sim.current;
    S.pts.delete(e.pointerId);
    if (S.pinch) {
      if (S.pts.size < 2) {
        S.pinch = null;
        S.ztarget = clamp(S.zoom, 1, ZOOM_MAX);
        S.target = S.pitch < 8 * DEG ? 0 : S.pitch;
        setFlat(S.target === 0);
        syncZoom();
        // A finger left on the glass carries on as a drag, never as a tap.
        const rest = [...S.pts.values()][0];
        S.drag = rest
          ? {
              x: rest.x,
              y: rest.y,
              yaw: S.yaw,
              pitch: S.pitch,
              moved: true,
              t: performance.now(),
              vx: 0,
              px: S.panX,
              py: S.panY,
            }
          : null;
      }
      wake();
      return;
    }
    const d = S.drag;
    S.drag = null;
    if (cancel) return wake();
    if (d && !d.moved) {
      const { x, y } = local(e);
      const now = performance.now();
      // Double tap: back to the starting view.
      if (now - S.tap.t < 320 && Math.hypot(x - S.tap.x, y - S.tap.y) < 30) {
        S.tap.t = 0;
        reset();
        return;
      }
      S.tap = { t: now, x, y };
      const c = hit(x, y);
      if (c >= 0) {
        S.origin = c;
        pick(c);
      }
    } else if (d && !(e.pointerType !== "mouse" && S.ztarget > 1.02))
      S.vyaw = d.vx * 0.6;
    wake();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      pick(Math.min(C - 1, sel + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      pick(Math.max(0, sel - 1));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.4);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(1 / 1.4);
    } else if (e.key === "0") {
      e.preventDefault();
      reset();
    }
  };
  // Ctrl or ⌘ with the wheel (and trackpad pinches) zoom; plain scrolling keeps scrolling the page.
  useEffect(() => {
    wheelRef.current = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const S = sim.current;
      const r = cv.current!.getBoundingClientRect();
      zoomAt(
        e.clientX - r.left,
        e.clientY - r.top,
        S.ztarget * Math.exp(-e.deltaY * 0.004),
      );
      syncZoom();
      wake();
    };
  });
  const setView = (f: boolean) => {
    const S = sim.current;
    setFlat(f);
    S.target = f ? 0 : PITCH;
    S.origin = f ? C : selRef.current;
    if (!f && Math.abs(S.yaw) < 2 * DEG) S.vyaw = (YAW * Math.LN2) / SPIN_HALF;
    wake();
  };

  const lines = readout(sel);
  return (
    <div className={s.wrap}>
      <div className={s.top}>
        <div className={s.read} aria-live="polite">
          <b>{cols[sel]?.label}</b>
          <span className={s.vals}>
            {lines.map((l) => (
              <span key={l.label}>
                <i style={{ background: l.color }} />
                {l.label} <em>{l.text}</em>
              </span>
            ))}
          </span>
        </div>
        <div className={s.toggle} role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={flat}
            onClick={() => setView(true)}
          >
            Flat
          </button>
          <button
            type="button"
            aria-pressed={!flat}
            onClick={() => setView(false)}
          >
            Terrain
          </button>
        </div>
      </div>
      <canvas
        ref={cv}
        className={s.canvas}
        style={{ height, touchAction: zoomed ? "none" : "pan-y" }}
        role="img"
        tabIndex={0}
        aria-label={`${label}. Drag to turn, pinch to zoom, tap a column for its values; arrow keys step through the hours, plus and minus zoom.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => up(e)}
        onPointerCancel={(e) => up(e, true)}
        onPointerLeave={() => {
          if (sim.current.hover !== -1) {
            sim.current.hover = -1;
            wake();
          }
        }}
        onKeyDown={key}
      />
      <div className={s.ctrl} role="group" aria-label="Move the chart">
        <button
          type="button"
          onClick={() => turnBy(-25 * DEG)}
          aria-label="Turn left"
        >
          ⟲
        </button>
        <button
          type="button"
          onClick={() => turnBy(25 * DEG)}
          aria-label="Turn right"
        >
          ⟳
        </button>
        <button
          type="button"
          onClick={() => tiltBy(12 * DEG)}
          aria-label="Tilt to look down"
        >
          ⤒
        </button>
        <button
          type="button"
          onClick={() => tiltBy(-12 * DEG)}
          aria-label="Tilt to look across"
        >
          ⤓
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          aria-label="Zoom out"
          disabled={!zoomed}
        >
          −
        </button>
        <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={s.reset} onClick={reset}>
          Reset
        </button>
        <span className={s.hint}>
          Drag to turn · pinch to zoom · two fingers up or down to tilt · double
          tap to reset
        </span>
      </div>
    </div>
  );
}
