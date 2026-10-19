"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "@/components/IntentLink";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { single } from "./Items";
import s from "./EdgePeek.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const SPOT = "sswx-peek-y";
const HOLD = 380;
/** Where the tab sits, as a share of the screen's height from the top (a third by default). */
const readSpot = () => {
  try {
    const v = Number(localStorage.getItem(SPOT));
    return v >= 0.1 && v <= 0.88 ? v : 0.34;
  } catch {
    return 0.34;
  }
};

/**
 * Edge Peek: a glowing tab on the screen's edge; pull it and a short stack of cards slides
 * out. Hold the tab and drag to move it up or down the edge; the spot is remembered.
 */
export function EdgePeek({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const [spot, setSpot] = useState(0.34);
  const [moving, setMoving] = useState(false);
  const tab = useRef<HTMLButtonElement>(null);
  const hold = useRef<{ timer: number; y: number; dragged: boolean } | null>(
    null,
  );
  useEffect(() => {
    const v = readSpot();
    if (v !== 0.34) queueMicrotask(() => setSpot(v));
  }, []);
  // A long press picks the tab up; while it's held, it follows the finger (transform only).
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    const y = e.clientY;
    const id = e.pointerId;
    const el = e.currentTarget;
    hold.current = {
      y,
      dragged: false,
      timer: window.setTimeout(() => {
        if (!hold.current) return;
        hold.current.dragged = true;
        el.setPointerCapture(id);
        navigator.vibrate?.(12);
        setMoving(true);
      }, HOLD),
    };
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const h = hold.current;
    if (!h) return;
    if (!h.dragged) {
      if (Math.abs(e.clientY - h.y) > 10) {
        clearTimeout(h.timer);
        hold.current = null;
      }
      return;
    }
    const v = Math.min(0.88, Math.max(0.1, e.clientY / innerHeight));
    tab.current?.style.setProperty("--y", String(v));
  };
  const up = () => {
    const h = hold.current;
    if (!h) return;
    clearTimeout(h.timer);
    if (h.dragged) {
      const v = Number(tab.current?.style.getPropertyValue("--y") || spot);
      setSpot(v);
      setMoving(false);
      try {
        localStorage.setItem(SPOT, String(v));
      } catch {}
    }
  };
  const left = placement.id.startsWith("left");
  const sel = groups.find((g) => g.id === sub);
  const items = sel
    ? sel.pages.map((pg) => ({
        key: pg.slug,
        label: pg.label,
        icon: pg.icon,
        to: href(pg),
      }))
    : groups.map((g) => {
        const one = single(g);
        return {
          key: g.id,
          label: one?.label ?? g.label,
          icon: one?.icon ?? g.icon,
          to: one ? href(one) : null,
        };
      });
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-left={left}
    >
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={s.stack}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
        key={sub ?? "top"}
      >
        <small className={s.title}>{sel ? sel.label : "Quick menu"}</small>
        {sel && (
          <button
            className={s.card}
            style={{ ["--i" as string]: 0 }}
            onClick={() => setSub(null)}
            tabIndex={open ? 0 : -1}
          >
            <i>
              <ArrowLeft aria-hidden />
            </i>
            <span>Back</span>
          </button>
        )}
        {items.map((it, n) => {
          const i = n + (sel ? 1 : 0);
          const body = (
            <>
              <i>
                <NavIcon name={it.icon} className="size-5" />
              </i>
              <span>{it.label}</span>
            </>
          );
          return it.to ? (
            <Link
              key={it.key}
              href={it.to}
              className={s.card}
              style={{ ["--i" as string]: i }}
              tabIndex={open ? 0 : -1}
              aria-current={path === it.to ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={it.key}
              className={s.card}
              style={{ ["--i" as string]: i }}
              tabIndex={open ? 0 : -1}
              onClick={() => setSub(it.key)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <button
        ref={tab}
        className={s.tab}
        data-moving={moving || undefined}
        style={{ ["--y" as string]: spot }}
        aria-label={
          open ? "Close quick menu" : "Open quick menu (hold to move it)"
        }
        aria-expanded={open}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          // The tap that ends a move doesn't open the menu.
          if (hold.current?.dragged) {
            hold.current = null;
            return;
          }
          hold.current = null;
          setOpen(!open);
        }}
      >
        <ChevronLeft aria-hidden />
      </button>
    </div>
  );
}
