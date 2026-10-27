"use client";

import Link from "@/components/IntentLink";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";
import { placeStyle } from "./place";
import s from "./Switcher.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

type Box = { x: number; y: number; w: number; h: number };

/**
 * Switcher: like a phone's app switcher. Swipe up on the handle and the page steps back while
 * a 3D stack of cards rises, one per shortcut or section, each previewing its pages. A
 * section's card zooms up to fill the screen with its pages; the bottom card returns to the page.
 */
export function Switcher({ groups, placement, role, all }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const [from, setFrom] = useState<Box | null>(null);
  const [grown, setGrown] = useState(false);
  const stack = useRef<HTMLDivElement>(null);
  const pos = placeStyle(placement.id, 132);
  const sel = groups.find((g) => g.id === sub);
  const current = [...(all ?? []), ...groups]
    .flatMap((g) => g.pages)
    .find((p) => href(p) === path);

  // The page steps back from the middle of what's on screen (transform and opacity only).
  useEffect(() => {
    const page = document.getElementById("app-content");
    if (!open || !page) return;
    page.style.transition =
      "transform .5s cubic-bezier(.2,1,.3,1), opacity .4s";
    page.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
    page.style.transform = "scale(.9)";
    page.style.opacity = ".3";
    requestAnimationFrame(() => {
      if (stack.current) stack.current.scrollTop = stack.current.scrollHeight;
    });
    return () => {
      page.style.transform = "";
      page.style.opacity = "";
      setTimeout(() => {
        if (!page.style.transform) page.style.transition = "";
      }, 600);
    };
  }, [open]);

  const pick = (g: NavGroup, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setFrom({ x: r.left, y: r.top, w: r.width, h: r.height });
    setGrown(false);
    setSub(g.id);
    requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
  };

  // Swipe up on the handle to open.
  const y0 = useRef<number | null>(null);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.stack}
        ref={stack}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
      >
        {groups.map((g, i) => {
          const one = g.pages.length === 1 ? g.pages[0] : null;
          const body = (
            <>
              <header>
                <NavIcon name={one?.icon ?? g.icon} className={s.ic} />
                <span>{one?.label ?? g.label}</span>
                <em>{one ? "OPEN" : `${g.pages.length} PAGES`}</em>
              </header>
              <span className={s.pv}>
                {g.pages.slice(0, 5).map((p) => (
                  <span key={p.slug}>{p.label}</span>
                ))}
                {g.pages.length > 5 && <span>+{g.pages.length - 5}</span>}
              </span>
            </>
          );
          const style = {
            ["--d" as string]: `${(groups.length - i) * 0.035}s`,
          };
          return one ? (
            <Link
              key={g.id}
              href={href(one)}
              className={s.card}
              style={style}
              tabIndex={open ? 0 : -1}
              aria-current={path === href(one) ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={g.id}
              className={s.card}
              style={style}
              tabIndex={open ? 0 : -1}
              onClick={(e) => pick(g, e.currentTarget)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <button
        className={s.now}
        onClick={() => setOpen(false)}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      >
        <small>Back to</small>
        <span>
          {current && <NavIcon name={current.icon} className={s.ic} />}
          {current?.label ?? "your page"}
        </span>
      </button>
      {sel && from && (
        <div
          className={s.full}
          style={{
            transform: grown
              ? "none"
              : `translate(${from.x}px,${from.y}px) scale(${from.w / innerWidth},${from.h / innerHeight})`,
          }}
        >
          <button className={s.back} onClick={() => setSub(null)}>
            <ArrowLeft aria-hidden /> All
          </button>
          <h2>
            <NavIcon name={sel.icon} className={s.ic} />
            {sel.label}
          </h2>
          <ul>
            {sel.pages.map((pg, i) => (
              <li key={pg.slug} style={{ ["--i" as string]: i }}>
                <Link
                  href={href(pg)}
                  aria-current={path === href(pg) ? "page" : undefined}
                >
                  <NavIcon name={pg.icon} className={s.ic} />
                  <span>{pg.label}</span>
                  <ChevronRight className={s.go} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        className={s.handle}
        style={pos}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onPointerDown={(e) => (y0.current = e.clientY)}
        onPointerUp={(e) => {
          const dy = y0.current === null ? 0 : e.clientY - y0.current;
          y0.current = null;
          if (dy < -24) setOpen(true);
        }}
        onClick={() => setOpen(!open)}
      >
        <span>Quick</span>
        <i />
      </button>
    </div>
  );
}
