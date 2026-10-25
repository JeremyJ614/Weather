"use client";

import Link from "@/components/IntentLink";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowUpRight } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import { groupOf, single } from "./Items";
import { placeStyle } from "./place";
import s from "./Shutter.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const SLATS = 10;

/**
 * Shutter: slats swing shut across the screen like blinds, then an index sets itself on
 * them: the sections down the left with a glowing marker that slides to the one you pick,
 * its pages cascading in on the right.
 */
export function Shutter({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const here = groupOf(groups, path);
  const multi = groups.filter((g) => !single(g));
  const [pick, setPick] = useState<string | null>(null);
  const active =
    groups.find((g) => g.id === pick) ??
    (here && !single(here) ? here : multi[0]);
  const list = useRef<HTMLUListElement>(null);
  const [mark, setMark] = useState({ y: 0, h: 0 });
  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[data-active]");
    if (el) setMark({ y: el.offsetTop, h: el.offsetHeight });
  }, [active?.id, open, groups]);
  const tab = open ? 0 : -1;
  // Just opened: the pages wait for the blinds before cascading in.
  const [entering, setEntering] = useState(false);
  const [was, setWas] = useState(open);
  if (was !== open) {
    setWas(open);
    setEntering(open);
  }
  useEffect(() => {
    if (!entering) return;
    const t = setTimeout(() => setEntering(false), 1200);
    return () => clearTimeout(t);
  }, [entering]);
  const n = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.blinds} aria-hidden>
        {Array.from({ length: SLATS }, (_, i) => (
          <i
            key={i}
            style={{ ["--i" as string]: i, ["--r" as string]: SLATS - 1 - i }}
          />
        ))}
      </div>
      <nav
        className={s.index}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <header className={s.head}>
          <p>Index</p>
          <h2 key={active?.id}>{active?.label ?? "Where to?"}</h2>
          <small>
            {n(Math.max(0, groups.indexOf(active!)))} — {n(groups.length - 1)}
          </small>
        </header>
        <div className={s.cols}>
          <ul className={s.secs} ref={list}>
            <li
              className={s.mark}
              style={{ "--y": `${mark.y}px`, "--h": mark.h } as CSSProperties}
              aria-hidden
            />
            {groups.map((g, i) => {
              const one = single(g);
              const st = { ["--i" as string]: i };
              return (
                <li
                  key={g.id}
                  style={st}
                  data-active={g === active || undefined}
                >
                  {one ? (
                    <Link
                      href={href(one)}
                      className={s.sec}
                      tabIndex={tab}
                      aria-current={path === href(one) ? "page" : undefined}
                    >
                      <em>{n(i)}</em>
                      <span>{one.label}</span>
                      <ArrowUpRight className={s.out} aria-hidden />
                    </Link>
                  ) : (
                    <button
                      className={s.sec}
                      tabIndex={tab}
                      aria-pressed={g === active}
                      data-here={here?.id === g.id || undefined}
                      onClick={() => setPick(g.id)}
                    >
                      <em>{n(i)}</em>
                      <span>{g.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <ul
            className={s.pages}
            key={`${active?.id}:${open}`}
            data-enter={entering || undefined}
          >
            {active?.pages.map((pg, i) => (
              <li key={pg.slug} style={{ ["--i" as string]: i }}>
                <Link
                  href={href(pg)}
                  className={s.page}
                  tabIndex={tab}
                  aria-current={path === href(pg) ? "page" : undefined}
                >
                  <NavIcon name={pg.icon} className={s.ic} />
                  <span>{pg.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <Burger
        open={open}
        onClick={() => setOpen(!open)}
        style={placeStyle(placement.id)}
      />
    </div>
  );
}
