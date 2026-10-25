"use client";

import Link from "@/components/IntentLink";
import { useRef, useState, type CSSProperties } from "react";
import { NavIcon } from "@/components/NavIcon";
import { flatPages } from "./Items";
import { isLeft, placeStyle } from "./place";
import s from "./CardFan.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const STEP = 18; // degrees between cards
const FIRST = 10; // the first card's tilt from straight up
const ARC = 72; // the visible arc
const FOCUS = FIRST + ARC / 2;

/**
 * Card Fan: the quick pages fan out of the corner like a hand of cards. Drag anywhere (or
 * scroll) to spin the hand; the card in the middle of the arc lifts, and a sheen slides over
 * each card as it turns. Tap a card to go.
 */
export function CardFan({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const cards = flatPages(groups);
  const left = isLeft(placement.id);
  const sign = left ? 1 : -1;
  const max = Math.max(0, (cards.length - 1) * STEP - ARC);
  const [spin, setSpin] = useState(0);
  const [drag, setDrag] = useState(false);
  const fab = placeStyle(placement.id, 60);
  const pivot = useRef<HTMLDivElement>(null);
  const from = useRef<{ a: number; spin: number; moved: boolean } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(0, v));
  const angleAt = (x: number, y: number) => {
    const r = pivot.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  };
  const snap = (v: number) => clamp(Math.round(v / STEP) * STEP);
  const focusIdx = Math.round((spin + FOCUS - FIRST) / STEP);
  // Opening brings the current page's card to the middle.
  const toggle = () => {
    if (!open) {
      const k = cards.findIndex((c) => c.to === path);
      setSpin(k < 0 ? 0 : snap(k * STEP - (FOCUS - FIRST)));
    }
    setOpen(!open);
  };

  return (
    // Spinning works from anywhere, cards included; once a drag starts the pointer is
    // captured here, so lifting the finger over a card doesn't open it.
    <div
      className={`${open ? s.on : ""} ${drag ? s.drag : ""}`}
      data-menu-role={role}
      data-left={left || undefined}
      onPointerDown={(e) => {
        if (!open || (e.target as Element).closest("button")) return;
        from.current = {
          a: angleAt(e.clientX, e.clientY),
          spin,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const f = from.current;
        if (!f) return;
        const d = angleAt(e.clientX, e.clientY) - f.a;
        if (!f.moved && Math.abs(d) < 2) return;
        if (!f.moved) {
          f.moved = true;
          setDrag(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        setSpin(clamp(f.spin - sign * d));
      }}
      onPointerUp={() => {
        const f = from.current;
        from.current = null;
        if (f?.moved) {
          setDrag(false);
          setSpin((v) => snap(v));
        }
      }}
      onPointerCancel={() => {
        from.current = null;
        setDrag(false);
        setSpin((v) => snap(v));
      }}
      onWheel={(e) =>
        open && setSpin((v) => snap(v + Math.sign(e.deltaY) * STEP))
      }
    >
      <div className={s.ov} onClick={() => setOpen(false)} aria-hidden>
        <p className={s.hint}>
          {cards.length > 6 ? "Drag to spin the deck · " : ""}
          {cards.length} {cards.length === 1 ? "page" : "pages"}
        </p>
      </div>
      <div className={s.pivot} style={fab} ref={pivot}>
        <nav
          className={s.hand}
          aria-label={role === "main" ? "Main menu" : "Second menu"}
          aria-hidden={!open}
        >
          {cards.map((c, i) => {
            const a = FIRST + i * STEP - spin;
            const shown = a > 2 && a < FIRST + ARC + 14;
            const st = {
              "--i": i,
              "--r": `${(sign * a).toFixed(2)}deg`,
              "--rn": (sign * a).toFixed(2),
              "--lift": i === focusIdx ? "-24px" : "0px",
              "--sc": i === focusIdx ? 1.08 : 1,
              "--o": shown ? 1 : 0,
            } as CSSProperties;
            return (
              <Link
                key={c.key}
                href={c.to}
                className={s.card}
                style={st}
                data-focus={i === focusIdx || undefined}
                tabIndex={open && shown ? 0 : -1}
                aria-current={path === c.to ? "page" : undefined}
                draggable={false}
                onFocus={() => setSpin(snap(i * STEP - (FOCUS - FIRST)))}
              >
                <i>
                  <NavIcon name={c.icon} className="size-7" />
                </i>
                <b>{c.label}</b>
                <small>{path === c.to ? "You're here" : c.group}</small>
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        className={s.fab}
        style={fab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className={s.deck} aria-hidden>
          <i />
          <i />
          <i />
        </span>
      </button>
    </div>
  );
}
