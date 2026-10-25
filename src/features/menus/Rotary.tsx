"use client";

import Link from "@/components/IntentLink";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { entries, flatPages, type Entry } from "./Items";
import { placeStyle } from "./place";
import s from "./Rotary.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** −180..180 */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const TICKS = Array.from({ length: 72 }, (_, i) => i);

/**
 * Rotary: a dial fills the screen. The quick pages ride around its rim; turn it with a
 * finger (it clicks into place at each page) and the hub shows the page under the notch:
 * tap the hub to go. With many pages it turns through sections first.
 */
export function Rotary({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const flat = flatPages(groups);
  const drill = flat.length > 16;
  const sel = groups.find((g) => g.id === sub);
  const items: (Entry & { group?: string })[] = drill
    ? entries(groups, sel)
    : flat;
  const n = Math.max(items.length, 1);
  const step = 360 / n;
  const [rot, setRot] = useState(0);
  // A new ring (a section opened or closed) starts at its first page.
  const [ring, setRing] = useState(sub);
  if (ring !== sub) {
    setRing(sub);
    setRot(0);
  }
  const [drag, setDrag] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const from = useRef<{ a: number; rot: number; moved: boolean } | null>(null);
  const idx = (((Math.round(-rot / step) % n) + n) % n) as number;
  const cur = items[idx];
  const last = useRef(idx);
  useEffect(() => {
    if (open && last.current !== idx) navigator.vibrate?.(4);
    last.current = idx;
  }, [idx, open]);
  const angleAt = (x: number, y: number) => {
    const r = wheel.current!.getBoundingClientRect();
    return (
      (Math.atan2(x - (r.left + r.width / 2), r.top + r.height / 2 - y) * 180) /
      Math.PI
    );
  };
  const goTo = (i: number) => setRot((v) => v + wrap(-i * step - v));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo((idx - 1 + n) % n);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo((idx + 1) % n);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  const toggle = () => {
    if (!open) {
      const k = items.findIndex((it) => it.to === path);
      setRot(k < 0 ? 0 : -k * step);
    }
    setOpen(!open);
  };
  const fab = placeStyle(placement.id, 60);
  const tab = open ? 0 : -1;
  const hub = cur && (
    <>
      <i key={cur.key}>
        <NavIcon name={cur.icon} className="size-9" />
      </i>
      <b key={`${cur.key}-l`}>{cur.label}</b>
      <small>
        {cur.to
          ? path === cur.to
            ? "You're here"
            : (cur.group ?? sel?.label ?? "Open")
          : `${groups.find((g) => g.id === cur.key)?.pages.length} pages`}
      </small>
      <em>
        {cur.to ? "Open" : "Turn through"} <ArrowUpRight aria-hidden />
      </em>
    </>
  );

  return (
    <div
      className={`${open ? s.on : ""} ${drag ? s.drag : ""}`}
      data-menu-role={role}
    >
      <div className={s.ov} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.stage}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <p className={s.kicker}>
          {sel ? (
            <button tabIndex={tab} onClick={() => setSub(null)}>
              <ArrowLeft aria-hidden /> {sel.label}
            </button>
          ) : (
            "Turn the dial"
          )}
        </p>
        <div
          className={s.dial}
          ref={wheel}
          onPointerDown={(e) => {
            if ((e.target as Element).closest(`.${s.hub}`)) return;
            from.current = {
              a: angleAt(e.clientX, e.clientY),
              rot,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            const f = from.current;
            if (!f) return;
            const d = wrap(angleAt(e.clientX, e.clientY) - f.a);
            if (!f.moved && Math.abs(d) < 3) return;
            if (!f.moved) {
              f.moved = true;
              setDrag(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            f.a = angleAt(e.clientX, e.clientY);
            f.rot += d;
            setRot(f.rot);
          }}
          onPointerUp={() => {
            const f = from.current;
            from.current = null;
            if (!f?.moved) return;
            setDrag(false);
            setRot((v) => Math.round(v / step) * step);
          }}
          onPointerCancel={() => {
            from.current = null;
            setDrag(false);
            setRot((v) => Math.round(v / step) * step);
          }}
        >
          <span className={s.notch} aria-hidden />
          <div
            className={s.wheel}
            style={{ "--rot": `${rot}deg` } as CSSProperties}
          >
            <svg className={s.ticks} viewBox="0 0 200 200" aria-hidden>
              {TICKS.map((t) => (
                <line
                  key={t}
                  x1="100"
                  y1={t % 6 ? 6 : 3}
                  x2="100"
                  y2="11"
                  transform={`rotate(${t * 5} 100 100)`}
                />
              ))}
            </svg>
            {items.map((it, i) => {
              const st = {
                "--a": `${i * step}deg`,
                "--i": i,
              } as CSSProperties;
              const body = <NavIcon name={it.icon} className="size-5" />;
              const props = {
                className: s.item,
                style: st,
                tabIndex: tab,
                "aria-label": it.label,
                "data-on": i === idx || undefined,
                "aria-current": path === it.to ? ("page" as const) : undefined,
              };
              return it.to && i === idx ? (
                <Link key={it.key} href={it.to} {...props}>
                  {body}
                </Link>
              ) : (
                <button
                  key={it.key}
                  {...props}
                  onClick={() =>
                    i === idx && !it.to ? setSub(it.key) : goTo(i)
                  }
                >
                  {body}
                </button>
              );
            })}
          </div>
          {cur?.to ? (
            <Link href={cur.to} className={s.hub} tabIndex={tab}>
              {hub}
            </Link>
          ) : (
            <button
              className={s.hub}
              tabIndex={tab}
              onClick={() => cur && setSub(cur.key)}
            >
              {hub}
            </button>
          )}
        </div>
        <p className={s.count}>
          {String(idx + 1).padStart(2, "0")} /{" "}
          {String(items.length).padStart(2, "0")}
        </p>
      </nav>
      <button
        className={s.fab}
        style={fab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="13" />
          <path d="M20 4v7" />
          <circle cx="20" cy="20" r="3.5" className={s.dot} />
        </svg>
      </button>
    </div>
  );
}
