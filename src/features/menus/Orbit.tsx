"use client";

import Link from "@/components/IntentLink";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import { entries, groupOf } from "./Items";
import { placeStyle } from "./place";
import s from "./Orbit.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** −180..180 */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Orbit: the sections stand on a ring in 3D that spins into view. Drag (or use the arrows)
 * to turn it, with momentum, and it settles on the nearest card; tap the front card to open
 * it, and its pages rise from below while the ring steps back.
 */
export function Orbit({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const items = entries(groups);
  const n = Math.max(items.length, 3);
  const step = 360 / n;
  const here = groupOf(groups, path);
  const [w, setW] = useState(170);
  const [spin, setSpin] = useState(0);
  const [drag, setDrag] = useState(false);
  const from = useRef<{
    x: number;
    spin: number;
    t: number;
    v: number;
    moved: boolean;
  } | null>(null);
  const sel = groups.find((g) => g.id === sub);
  useEffect(() => {
    const size = () => setW(Math.min(innerWidth * 0.42, 180));
    size();
    addEventListener("resize", size);
    return () => removeEventListener("resize", size);
  }, []);
  const R = Math.round((w / 2 + 12) / Math.tan(Math.PI / n));
  const front = (((Math.round(-spin / step) % n) + n) % n) % items.length;
  const goTo = (i: number) => setSpin((v) => v + wrap(-i * step - v));
  const turn = (d: number) =>
    setSpin((v) => Math.round(v / step) * step - d * step);
  useEffect(() => {
    if (!open || sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") turn(-1);
      if (e.key === "ArrowRight") turn(1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  const toggle = () => {
    if (!open) {
      const k = items.findIndex((it) => it.key === here?.id || it.to === path);
      setSpin(k < 0 ? 0 : -k * step);
    }
    setOpen(!open);
  };

  return (
    <div
      className={`${open ? s.on : ""} ${drag ? s.drag : ""} ${sel ? s.deep : ""}`}
      data-menu-role={role}
    >
      <div className={s.ov} aria-hidden />
      <nav
        className={s.stage}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
        onPointerDown={(e) => {
          if (sel || (e.target as Element).closest(`.${s.ctrl}`)) return;
          from.current = {
            x: e.clientX,
            spin,
            t: performance.now(),
            v: 0,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const f = from.current;
          if (!f) return;
          const dx = e.clientX - f.x;
          if (!f.moved && Math.abs(dx) < 6) return;
          if (!f.moved) {
            f.moved = true;
            setDrag(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const now = performance.now();
          const next = f.spin + dx * 0.32;
          f.v = (next - spin) / Math.max(8, now - f.t);
          f.t = now;
          setSpin(next);
        }}
        onPointerUp={() => {
          const f = from.current;
          from.current = null;
          if (!f?.moved) return;
          setDrag(false);
          // Momentum: carry on in the flick's direction, then settle on a card.
          setSpin((v) => Math.round((v + f.v * 260) / step) * step);
        }}
        onPointerCancel={() => {
          from.current = null;
          setDrag(false);
          setSpin((v) => Math.round(v / step) * step);
        }}
      >
        <p className={s.kicker}>
          {String(front + 1).padStart(2, "0")} /{" "}
          {String(items.length).padStart(2, "0")}
        </p>
        <div className={s.scene}>
          <div
            className={s.ring}
            style={
              {
                "--spin": `${spin}deg`,
                "--R": `${R}px`,
                "--w": `${w}px`,
              } as CSSProperties
            }
          >
            {items.map((it, i) => {
              const rel = wrap(i * step + spin);
              const near = Math.abs(rel) < 100;
              const st = {
                "--a": `${i * step}deg`,
                "--o": (
                  0.18 +
                  0.82 * Math.max(0, Math.cos((rel * Math.PI) / 180)) ** 1.5
                ).toFixed(3),
                "--i": i,
              } as CSSProperties;
              const body = (
                <>
                  <i>
                    <NavIcon name={it.icon} className="size-8" />
                  </i>
                  <b>{it.label}</b>
                  <small>
                    {it.to
                      ? path === it.to
                        ? "You're here"
                        : "Open"
                      : `${groups.find((g) => g.id === it.key)?.pages.length} pages`}
                  </small>
                </>
              );
              const props = {
                className: s.card,
                style: st,
                tabIndex: open && !sel && near ? 0 : -1,
                "data-front": i === front || undefined,
                "data-here": here?.id === it.key || path === it.to || undefined,
              };
              return it.to && i === front ? (
                <Link key={it.key} href={it.to} {...props}>
                  {body}
                </Link>
              ) : (
                <button
                  key={it.key}
                  {...props}
                  onClick={() => (i === front ? setSub(it.key) : goTo(i))}
                >
                  {body}
                </button>
              );
            })}
          </div>
          <div className={s.floor} aria-hidden />
        </div>
        <div className={s.ctrl}>
          <button
            aria-label="Previous section"
            tabIndex={open && !sel ? 0 : -1}
            onClick={() => turn(-1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <span>{items[front]?.label}</span>
          <button
            aria-label="Next section"
            tabIndex={open && !sel ? 0 : -1}
            onClick={() => turn(1)}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
        {sel && (
          <div className={s.sheet} key={sel.id}>
            <button className={s.back} onClick={() => setSub(null)}>
              <ArrowLeft aria-hidden /> Back to the ring
            </button>
            <h2>{sel.label}</h2>
            <div className={s.pages}>
              {sel.pages.map((pg, i) => (
                <Link
                  key={pg.slug}
                  href={href(pg)}
                  className={s.page}
                  style={{ ["--i" as string]: i }}
                  aria-current={path === href(pg) ? "page" : undefined}
                >
                  <NavIcon name={pg.icon} className="size-5 text-accent" />
                  <span>{pg.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      <Burger open={open} onClick={toggle} style={placeStyle(placement.id)} />
    </div>
  );
}
