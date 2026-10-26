"use client";

import Link from "@/components/IntentLink";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { href } from "@/lib/nav/registry";
import { entries, groupOf } from "./Items";
import { fabPlace } from "./place";
import f from "./Fab.module.css";
import s from "./KineticType.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const two = (n: number) => String(n + 1).padStart(2, "0");

/**
 * Kinetic Type: a full-screen index in huge letters. Each section rises out of its own slot,
 * the lines lean with the speed of a scroll, and a giant outlined word drifts behind. A section
 * sweeps the others away, rises to the top and its pages rise underneath.
 */
export function KineticType({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const [pick, setPick] = useState({ up: 0, h: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const items = entries(groups);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);

  // Lines lean with the scroll speed and settle back (transform only).
  useEffect(() => {
    const el = scroller.current;
    const ls = list.current;
    if (
      !open ||
      !el ||
      !ls ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let last = el.scrollTop;
    let skew = 0;
    let raf = 0;
    const tick = () => {
      const v = el.scrollTop - last;
      last = el.scrollTop;
      skew += (Math.max(-9, Math.min(9, v * 0.35)) - skew) * 0.18;
      if (Math.abs(skew) < 0.02 && Math.abs(v) < 0.1) {
        ls.style.transform = "";
        raf = 0;
        return;
      }
      ls.style.transform = `skewY(${skew.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      ls.style.transform = "";
    };
  }, [open]);

  const word = sel?.label ?? "StormSync";
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div
        className={s.panel}
        aria-hidden={!open}
        data-sel={sel ? "" : undefined}
      >
        <div className={s.ghost} aria-hidden>
          {Array.from({ length: 4 }, () => `${word} · `).join("")}
        </div>
        <div className={s.scroll} ref={scroller}>
          <nav
            className={s.list}
            ref={list}
            aria-label={role === "main" ? "Main menu" : "Quick menu"}
          >
            {items.map((it, i) => {
              const style = {
                ["--d" as string]: `${0.06 + i * 0.05}s`,
                ["--up" as string]: `${-pick.up}px`,
              };
              const body = (
                <>
                  <span className={s.meta}>
                    <span>{two(i)}</span>
                    <span>
                      {it.to
                        ? "OPEN"
                        : `${groups.find((g) => g.id === it.key)?.pages.length ?? 0} PAGES`}
                    </span>
                  </span>
                  <span className={s.mask}>
                    <span className={s.word}>{it.label}</span>
                  </span>
                </>
              );
              const tab = open && !sel ? 0 : -1;
              return it.to ? (
                <Link
                  key={it.key}
                  href={it.to}
                  className={s.row}
                  style={style}
                  tabIndex={tab}
                  aria-current={path === it.to ? "page" : undefined}
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={it.key}
                  className={s.row}
                  style={style}
                  tabIndex={sel?.id === it.key ? -1 : tab}
                  data-pick={sel?.id === it.key || undefined}
                  data-here={here?.id === it.key || undefined}
                  onClick={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    setPick({ up: el.offsetTop, h: el.offsetHeight });
                    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
                    setSub(it.key);
                  }}
                >
                  {body}
                </button>
              );
            })}
            {sel && (
              <ul className={s.pages} key={sel.id} style={{ top: pick.h + 6 }}>
                {sel.pages.map((pg, i) => (
                  <li key={pg.slug} style={{ ["--i" as string]: i }}>
                    <Link
                      href={href(pg)}
                      aria-current={path === href(pg) ? "page" : undefined}
                    >
                      <em>{two(i)}</em>
                      <span className={s.pm}>
                        <span className={s.pw}>{pg.label}</span>
                      </span>
                      <ArrowUpRight aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </div>
        {sel && (
          <button className={s.back} onClick={() => setSub(null)}>
            <ArrowLeft aria-hidden /> All
          </button>
        )}
      </div>
      <button
        className={`${s.fab} ${fabPlace(placement.id, f)}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "CLOSE" : "MENU"}
      </button>
    </div>
  );
}
