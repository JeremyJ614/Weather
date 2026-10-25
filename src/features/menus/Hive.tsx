"use client";

import Link from "@/components/IntentLink";
import { useLayoutEffect, useRef } from "react";
import { ArrowLeft, Hexagon, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { entries, groupOf } from "./Items";
import { placeStyle } from "./place";
import s from "./Hive.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/**
 * Honeycomb rows: each row one cell longer or shorter than the last (so they interlock),
 * at most three cells, as few rows as possible, a symmetric shape when there is one
 * (7 → 2·3·2, 8 → 3·2·3, 9 → 1·2·3·2·1).
 */
export function combRows(n: number) {
  let best: number[] | null = null;
  const score = (r: number[]) =>
    r.length * 10 - (r.join() === [...r].reverse().join() ? 5 : 0) - r[0];
  const walk = (rows: number[], left: number) => {
    if (best && rows.length * 10 - 8 > score(best)) return;
    if (!left) {
      if (!best || score(rows) < score(best)) best = rows;
      return;
    }
    const last = rows.at(-1);
    for (const k of last ? [last + 1, last - 1] : [3, 2, 1])
      if (k >= 1 && k <= 3 && k <= left) walk([...rows, k], left - k);
  };
  walk([], n);
  return best ?? [n];
}

function rows<T>(list: T[]) {
  const out: T[][] = [];
  let i = 0;
  for (const k of combRows(list.length)) {
    out.push(list.slice(i, i + k));
    i += k;
  }
  return out;
}

/**
 * Hive: the button bursts into a honeycomb. Each section is a hexagon that flies out of the
 * button along its own path and locks into the comb; a hexagon opens into its pages, which
 * cascade in as a column of cells.
 */
export function Hive({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const comb = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const fab = placeStyle(placement.id, 62);

  // Where each hexagon starts: the button's center, measured from the cell's own place in
  // the comb (layout offsets, which transforms don't change).
  useLayoutEffect(() => {
    const el = comb.current;
    if (!el) return;
    const place = () => {
      const br = btn.current?.getBoundingClientRect();
      const fx = br ? br.left + br.width / 2 : innerWidth / 2;
      const fy = br ? br.top + br.height / 2 : innerHeight;
      const root = el.getBoundingClientRect();
      el.querySelectorAll<HTMLElement>(`.${s.hex}`).forEach((h, i) => {
        let x = h.offsetLeft + h.offsetWidth / 2;
        let y = h.offsetTop + h.offsetHeight / 2;
        for (let p = h.offsetParent as HTMLElement | null; p && p !== el;) {
          x += p.offsetLeft;
          y += p.offsetTop;
          p = p.offsetParent as HTMLElement | null;
        }
        const dx = fx - (root.left + x);
        const dy = fy - (root.top + y);
        h.style.setProperty("--fx", `${dx.toFixed(0)}px`);
        h.style.setProperty("--fy", `${dy.toFixed(0)}px`);
        // Nearest first, so the comb grows out of the button.
        h.style.setProperty(
          "--d",
          `${Math.round(Math.hypot(dx, dy) / 9 + i * 8)}ms`,
        );
      });
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [groups, placement.id]);

  const tiles = entries(groups);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.ov} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.stage}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
        data-sel={sel ? "" : undefined}
      >
        <p className={s.kicker}>{sel ? "Section" : "StormSync Weather"}</p>
        <div className={s.comb} ref={comb}>
          {rows(tiles).map((row, r) => (
            <div key={r} className={s.row}>
              {row.map((t) => {
                const body = (
                  <>
                    <svg
                      viewBox="0 0 100 115.47"
                      aria-hidden
                      className={s.cell}
                    >
                      <polygon points="50,2 98,29.9 98,85.6 50,113.5 2,85.6 2,29.9" />
                    </svg>
                    <NavIcon name={t.icon} className={s.ic} />
                    <span>{t.label}</span>
                  </>
                );
                return t.to ? (
                  <Link
                    key={t.key}
                    href={t.to}
                    className={s.hex}
                    tabIndex={open && !sel ? 0 : -1}
                    aria-current={path === t.to ? "page" : undefined}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={t.key}
                    className={s.hex}
                    data-here={here?.id === t.key || undefined}
                    data-pick={sub === t.key || undefined}
                    tabIndex={open && !sel ? 0 : -1}
                    onClick={() => setSub(t.key)}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {sel && (
          <div className={s.pages} key={sel.id}>
            <button className={s.back} onClick={() => setSub(null)}>
              <ArrowLeft aria-hidden /> All sections
            </button>
            <h2 className={s.title}>
              <i>
                <NavIcon name={sel.icon} className="size-6" />
              </i>
              {sel.label}
            </h2>
            <ul>
              {sel.pages.map((pg, i) => (
                <li key={pg.slug} style={{ ["--i" as string]: i }}>
                  <Link
                    href={href(pg)}
                    className={s.page}
                    aria-current={path === href(pg) ? "page" : undefined}
                  >
                    <span className={s.badge}>
                      <svg
                        viewBox="0 0 100 115.47"
                        aria-hidden
                        className={s.mini}
                      >
                        <polygon points="50,4 96,30.9 96,84.6 50,111.5 4,84.6 4,30.9" />
                      </svg>
                      <NavIcon name={pg.icon} className={s.pic} />
                    </span>
                    <span>{pg.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      <button
        ref={btn}
        className={s.fab}
        style={fab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 100 115.47" aria-hidden className={s.fabHex}>
          <polygon points="50,3 97,30.4 97,85.1 50,112.5 3,85.1 3,30.4" />
        </svg>
        <Hexagon className={s.open} aria-hidden />
        <X className={s.close} aria-hidden />
      </button>
    </div>
  );
}
