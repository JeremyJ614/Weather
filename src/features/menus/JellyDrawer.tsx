"use client";

import Link from "@/components/IntentLink";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { entries, groupOf } from "./Items";
import s from "./JellyDrawer.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** A gaussian bump 60 wide and 320 tall, drawn once and stretched with scaleX (mirrored on the right). */
const bumpPath = (mirror: boolean) => {
  const pts: string[] = [];
  for (let y = 0; y <= 320; y += 8) {
    const x = 60 * Math.exp(-(((y - 160) / 62) ** 2));
    pts.push(`${(mirror ? 60 - x : x).toFixed(2)},${y}`);
  }
  return `M${pts.join("L")}`;
};
const BUMP = { l: bumpPath(false), r: bumpPath(true) };

type Spring = { x: number; v: number; to: number };
const step = (sp: Spring, k: number, c: number, dt: number) => {
  const n = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    sp.v += (-k * (sp.x - sp.to) - c * sp.v) * h;
    sp.x += sp.v * h;
  }
};
const settled = (sp: Spring) =>
  Math.abs(sp.v) < 0.5 && Math.abs(sp.x - sp.to) < 0.5;

/**
 * Jelly Drawer: a side drawer with a living edge. Pull it out and its edge bulges toward the
 * finger, then wobbles flat on release (springs moving transforms only). Sections slide over
 * to their pages.
 */
export function JellyDrawer({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const right = placement.id.startsWith("right");
  const items = entries(groups);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const [dw, setDw] = useState(300);
  const drawer = useRef<HTMLDivElement>(null);
  const bump = useRef<SVGSVGElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const st = useRef({
    X: { x: 0, v: 0, to: 0 } as Spring,
    B: { x: 0, v: 0, to: 0 } as Spring,
    y: 0,
    held: false,
    raf: 0,
    dw: 300,
  });

  const render = useCallback(() => {
    const { X, B, y, dw: w } = st.current;
    const off = X.x - w;
    if (drawer.current)
      drawer.current.style.transform = `translateX(${(right ? -off : off).toFixed(1)}px)`;
    if (scrim.current)
      scrim.current.style.opacity = (
        0.6 * Math.min(1, Math.max(0, X.x / w))
      ).toFixed(3);
    if (bump.current)
      bump.current.style.transform = `translateY(${(y - 160).toFixed(1)}px) scaleX(${Math.max(0.001, B.x / 60).toFixed(3)})`;
  }, [right]);

  const run = useCallback(() => {
    const t = st.current;
    if (t.raf) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!t.held) step(t.X, 220, 24, dt);
      step(t.B, 260, 9, dt);
      render();
      if (!t.held && settled(t.X) && settled(t.B)) {
        t.X.x = t.X.to;
        t.B.x = 0;
        render();
        t.raf = 0;
        return;
      }
      t.raf = requestAnimationFrame(tick);
    };
    t.raf = requestAnimationFrame(tick);
  }, [render]);

  useEffect(() => {
    const fit = () => {
      const w = Math.round(Math.min(320, innerWidth * 0.84));
      st.current.dw = w;
      st.current.y = innerHeight / 2;
      setDw(w);
      if (!st.current.raf) {
        st.current.X.x = st.current.X.to = open ? w : 0;
        render();
      }
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  // Open and close (from the tab, a link, Escape or navigation) spring the drawer with a wobble.
  useEffect(() => {
    const t = st.current;
    t.X.to = open ? t.dw : 0;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      t.B.v += open ? 700 : 300;
    run();
  }, [open, run]);

  useEffect(() => {
    const t = st.current;
    return () => {
      cancelAnimationFrame(t.raf);
      t.raf = 0;
    };
  }, []);

  // Drags: the tab pulls the drawer out; a sideways drag on the drawer pushes it back.
  const tabEl = useRef<HTMLButtonElement>(null);
  const paneEl = useRef<HTMLElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    const dir = right ? -1 : 1;
    const bind = (el: HTMLElement | null, from: "tab" | "pane") => {
      if (!el) return () => {};
      let id: number | null = null;
      let x0 = 0;
      let y0 = 0;
      let start = 0;
      let moved = false;
      let lx = 0;
      let lt = 0;
      let vx = 0;
      const down = (e: PointerEvent) => {
        id = e.pointerId;
        x0 = lx = e.clientX;
        y0 = e.clientY;
        lt = performance.now();
        start = st.current.X.x;
        moved = false;
        vx = 0;
      };
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        const dx = (e.clientX - x0) * dir;
        const dy = e.clientY - y0;
        if (!moved) {
          if (Math.hypot(dx, dy) < 8) return;
          if (from === "pane" && (dx > -8 || Math.abs(dy) > Math.abs(dx))) {
            id = null;
            return;
          }
          moved = true;
          el.setPointerCapture?.(e.pointerId);
          st.current.held = true;
          run();
        }
        const now = performance.now();
        vx = ((e.clientX - lx) / Math.max(1, now - lt)) * 1000 * dir;
        lx = e.clientX;
        lt = now;
        const t = st.current;
        t.X.x = Math.max(0, Math.min(t.dw + 30, start + dx));
        t.y = Math.max(140, Math.min(innerHeight - 140, e.clientY));
        t.B.to = Math.min(58, Math.abs(vx) * 0.04);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = null;
        const t = st.current;
        t.B.to = 0;
        if (!moved) {
          if (from === "tab") setOpen(!openRef.current);
          return;
        }
        t.held = false;
        const want = vx > 300 || (vx > -300 && t.X.x > t.dw * 0.45);
        if (want === openRef.current) {
          t.X.to = want ? t.dw : 0;
          run();
        } else setOpen(want);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      return () => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
    };
    const a = bind(tabEl.current, "tab");
    const b = bind(paneEl.current, "pane");
    return () => {
      a();
      b();
    };
  }, [right, run, setOpen]);

  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-right={right || undefined}
    >
      <div
        ref={scrim}
        className={s.scrim}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        ref={drawer}
        className={s.drawer}
        style={{ width: dw, transform: `translateX(${right ? dw : -dw}px)` }}
      >
        <svg
          ref={bump}
          className={s.bump}
          viewBox="0 0 60 320"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            className={s.fill}
            d={right ? `${BUMP.r}L60,320L60,0Z` : `${BUMP.l}L0,320L0,0Z`}
          />
          <path className={s.edge} d={right ? BUMP.r : BUMP.l} />
        </svg>
        <button
          className={s.tab}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          ref={tabEl}
        >
          <i />
        </button>
        <nav
          className={s.pane}
          aria-label={role === "main" ? "Main menu" : "Quick menu"}
          aria-hidden={!open}
          ref={paneEl}
        >
          <div className={s.track} data-sub={sel ? "" : undefined}>
            <div className={s.col}>
              <small>StormSync Weather</small>
              <h2>Menu</h2>
              {items.map((it, i) => {
                const body = (
                  <>
                    <NavIcon name={it.icon} className={s.ic} />
                    <span>{it.label}</span>
                    {it.to ? (
                      <ArrowUpRight className={s.go} aria-hidden />
                    ) : (
                      <ChevronRight className={s.go} aria-hidden />
                    )}
                  </>
                );
                const tab = open && !sel ? 0 : -1;
                return it.to ? (
                  <Link
                    key={it.key}
                    href={it.to}
                    className={s.row}
                    style={{ ["--i" as string]: i }}
                    tabIndex={tab}
                    aria-current={path === it.to ? "page" : undefined}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={it.key}
                    className={s.row}
                    style={{ ["--i" as string]: i }}
                    tabIndex={tab}
                    data-here={here?.id === it.key || undefined}
                    onClick={() => setSub(it.key)}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
            <div className={s.col}>
              {sel && (
                <>
                  <button
                    className={s.back}
                    onClick={() => setSub(null)}
                    tabIndex={open ? 0 : -1}
                  >
                    <ArrowLeft aria-hidden /> Menu
                  </button>
                  <small>Section</small>
                  <h2>{sel.label}</h2>
                  {sel.pages.map((pg, i) => (
                    <Link
                      key={pg.slug}
                      href={href(pg)}
                      className={s.row}
                      style={{ ["--i" as string]: i }}
                      tabIndex={open ? 0 : -1}
                      aria-current={path === href(pg) ? "page" : undefined}
                    >
                      <NavIcon name={pg.icon} className={s.ic} />
                      <span>{pg.label}</span>
                      <ChevronRight className={s.go} aria-hidden />
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
