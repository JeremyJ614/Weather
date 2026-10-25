"use client";

import Link from "@/components/IntentLink";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { entries, groupOf, type Entry } from "./Items";
import { isLeft, placeStyle } from "./place";
import s from "./RibbonFold.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Stays true a little after `on` turns off, so a closing animation can finish. */
function useLinger(on: boolean, ms: number) {
  const [live, setLive] = useState(on);
  if (on && !live) setLive(true);
  useEffect(() => {
    if (on) return;
    const t = setTimeout(() => setLive(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return live;
}

/**
 * Each panel holds the next one, hinged to its bottom edge, so the ribbon unfolds panel by
 * panel like folded paper opening (each hinge swings once its parent is flat).
 */
function Folds({ rows, i = 0 }: { rows: ReactNode[]; i?: number }) {
  if (i >= rows.length)
    return (
      <div className={s.tail} style={{ ["--i" as string]: i }} aria-hidden>
        <svg viewBox="0 0 100 24" preserveAspectRatio="none">
          <path d="M0 0H100V24L50 6L0 24Z" />
        </svg>
      </div>
    );
  return (
    <div className={s.panel} style={{ ["--i" as string]: i }}>
      {rows[i]}
      <div className={s.next}>
        <Folds rows={rows} i={i + 1} />
      </div>
    </div>
  );
}

/**
 * Ribbon Fold: a bookmark ribbon hangs from the top of the screen; pull it and a satin
 * ribbon unfolds down the page, one hinged panel at a time. A section unfolds again into
 * its pages. Closing rolls the ribbon back up.
 */
export function RibbonFold({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const live = useLinger(open, 420);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const left = isLeft(placement.id);
  const tab = { ...placeStyle(placement.id), top: 0 };
  const items: Entry[] = entries(groups, sel);
  const tabbable = open ? 0 : -1;
  const row = (it: Entry, n: number) => {
    const body = (
      <>
        <em>{String(n + 1).padStart(2, "0")}</em>
        <NavIcon name={it.icon} className={s.ic} />
        <span>{it.label}</span>
        {it.to ? (
          <ArrowUpRight className={s.go} aria-hidden />
        ) : (
          <ChevronRight className={s.go} aria-hidden />
        )}
      </>
    );
    return it.to ? (
      <Link
        key={it.key}
        href={it.to}
        className={s.row}
        tabIndex={tabbable}
        aria-current={path === it.to ? "page" : undefined}
      >
        {body}
      </Link>
    ) : (
      <button
        key={it.key}
        className={s.row}
        tabIndex={tabbable}
        data-here={here?.id === it.key || undefined}
        onClick={() => setSub(it.key)}
      >
        {body}
      </button>
    );
  };
  const rows = [
    sel ? (
      <button
        key="back"
        className={`${s.row} ${s.head}`}
        tabIndex={tabbable}
        onClick={() => setSub(null)}
      >
        <ArrowLeft className={s.ic} aria-hidden />
        <span>{sel.label}</span>
        <small>All sections</small>
      </button>
    ) : (
      <p key="head" className={`${s.row} ${s.head}`}>
        <span>Where to?</span>
        <small>{groups.length} sections</small>
      </p>
    ),
    ...items.map(row),
  ];

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.ov} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.band}
        data-left={left || undefined}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        {live && (
          <div className={s.persp} key={sub ?? "top"}>
            <Folds rows={rows} />
          </div>
        )}
      </nav>
      <button
        className={s.tab}
        style={tab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 36 60" aria-hidden>
          <path d="M1 0H35V59L18 46L1 59Z" />
        </svg>
        <i />
        <i />
      </button>
    </div>
  );
}
