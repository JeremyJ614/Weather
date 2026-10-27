"use client";

import Link from "@/components/IntentLink";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Menu, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { entries, groupOf } from "./Items";
import { placeStyle } from "./place";
import s from "./LiquidMetal.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

type Geo = { W: number; H: number; fx: number; fy: number };

/**
 * Liquid Metal: the button melts into dark liquid with a gold edge (an SVG metaball filter over
 * plain circles). Each section buds off it as a droplet; picking one pours the others back into
 * it while it spreads into a pool of its pages. Slow phones get the droplets without the filter.
 */
export function LiquidMetal({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const fid = `lq${useId().replace(/[^a-z0-9]/gi, "")}`;
  const btn = useRef<HTMLButtonElement>(null);
  const [last, setLast] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  const fab = placeStyle(placement.id, 64);

  useLayoutEffect(() => {
    const measure = () => {
      const r = btn.current?.getBoundingClientRect();
      setGeo({
        W: innerWidth,
        H: innerHeight,
        fx: r ? r.left + r.width / 2 : innerWidth / 2,
        fy: r ? r.top + r.height / 2 : innerHeight - 50,
      });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [placement.id]);

  const items = entries(groups);
  const here = groupOf(groups, path);
  const sel = groups.find((g) => g.id === sub);
  const selIdx = sel ? items.findIndex((it) => it.key === sel.id) : -1;

  const W = geo?.W ?? 390;
  const D = Math.round(Math.min(82, W * 0.205));
  const fx = geo?.fx ?? W / 2;
  const fy = geo?.fy ?? 760;
  const cols = 3;
  const gap = (Math.min(W, 520) - cols * D) / (cols + 1);
  const rows = Math.ceil(items.length / cols);
  const rowH = D + 50;
  const top = Math.max(76, (fy - 64 - rows * rowH) / 2 + 30);
  const slots = items.map((_, i) => {
    const r = Math.floor(i / cols);
    const n = Math.min(cols, items.length - r * cols);
    const x =
      (W - (n * D + (n - 1) * gap)) / 2 + (i % cols) * (D + gap) + D / 2;
    return { x, y: top + r * rowH + D / 2 + Math.sin(i * 2.3) * 6 };
  });
  // Nearest the button first, so the droplets grow out of it.
  const order = new Map(
    slots
      .map((p, i) => [Math.hypot(p.x - fx, p.y - fy), i] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, i], k) => [i, k]),
  );
  const PX = 16;
  const PY = 72;
  const PW = W - 32;
  const PH = Math.max(240, fy - 50 - PY);
  const anchor = slots[last] ?? { x: fx, y: fy };

  const blob = (i: number) => {
    const k = order.get(i) ?? i;
    if (!open)
      return {
        transform: `translate(${fx - D / 2}px,${fy - D / 2}px) scale(.4)`,
        transitionDelay: `${(items.length - k) * 30}ms`,
      };
    if (sel && i !== selIdx)
      return {
        transform: `translate(${anchor.x - D / 2}px,${anchor.y - D / 2}px) scale(.55)`,
        transitionDelay: `${Math.abs(i - selIdx) * 30}ms`,
      };
    return {
      transform: `translate(${slots[i].x - D / 2}px,${slots[i].y - D / 2}px)`,
      transitionDelay: sel ? "0ms" : `${40 + k * 55}ms`,
    };
  };

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} aria-hidden />
      <svg width="0" height="0" className={s.defs} aria-hidden>
        <defs>
          <filter id={fid} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" />
            <feColorMatrix
              in="b"
              mode="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -11"
              result="goo"
            />
            <feMorphology in="goo" operator="erode" radius="1.7" result="in" />
            <feComposite in="goo" in2="in" operator="out" result="ring" />
            <feFlood style={{ floodColor: "var(--accent)" }} result="gold" />
            <feComposite in="gold" in2="ring" operator="in" result="edge" />
            <feFlood style={{ floodColor: "var(--surface2)" }} result="dark" />
            <feComposite in="dark" in2="in" operator="in" result="fill" />
            <feGaussianBlur in="edge" stdDeviation="3.5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="fill" />
              <feMergeNode in="edge" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className={s.goo} style={{ filter: `url(#${fid})` }} aria-hidden>
        <i
          className={s.pool}
          style={{
            width: PW,
            height: PH,
            transform: sel
              ? `translate(${PX}px,${PY}px)`
              : `translate(${anchor.x - 6}px,${anchor.y - 6}px) scale(${12 / PW},${12 / PH})`,
          }}
          data-on={sel ? "" : undefined}
        />
        {items.map((it, i) => (
          <i
            key={it.key}
            className={s.blob}
            style={{ width: D, height: D, ...blob(i) }}
          />
        ))}
        <i
          className={s.core}
          style={{
            transform: `translate(${fx - 32}px,${fy - 32}px) scale(${open ? 1.08 : 1})`,
          }}
        />
      </div>
      <nav
        className={s.labels}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open || !!sel}
        style={{ ["--D" as string]: `${D}px` }}
      >
        {items.map((it, i) => {
          const style = {
            transform: `translate(${slots[i].x - D / 2 - 15}px,${slots[i].y - D / 2}px)`,
            width: D + 30,
            ["--d" as string]: `${0.35 + (order.get(i) ?? i) * 0.055}s`,
          };
          const body = (
            <>
              <span className={s.o}>
                <NavIcon name={it.icon} className={s.ic} />
              </span>
              <span>{it.label}</span>
            </>
          );
          const tab = open && !sel ? 0 : -1;
          return it.to ? (
            <Link
              key={it.key}
              href={it.to}
              className={s.lab}
              style={style}
              tabIndex={tab}
              aria-current={path === it.to ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={it.key}
              className={s.lab}
              style={style}
              tabIndex={tab}
              data-here={here?.id === it.key || undefined}
              onClick={() => {
                setLast(i);
                setSub(it.key);
              }}
            >
              {body}
            </button>
          );
        })}
      </nav>
      {sel && (
        <div
          className={s.pages}
          key={sel.id}
          style={{ left: PX, top: PY, width: PW, height: PH }}
        >
          <header>
            <button onClick={() => setSub(null)} aria-label="All sections">
              <ArrowLeft aria-hidden />
            </button>
            <h2>{sel.label}</h2>
          </header>
          <ul>
            {sel.pages.map((pg, i) => (
              <li key={pg.slug} style={{ ["--i" as string]: i }}>
                <Link
                  href={href(pg)}
                  aria-current={path === href(pg) ? "page" : undefined}
                >
                  <NavIcon name={pg.icon} className={s.pic} />
                  <span>{pg.label}</span>
                  <ChevronRight className={s.go} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        ref={btn}
        className={s.fab}
        style={fab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Menu className={s.m} aria-hidden />
        <X className={s.x} aria-hidden />
      </button>
    </div>
  );
}
