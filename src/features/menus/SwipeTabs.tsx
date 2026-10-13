"use client";

import { useEffect, useRef, useState } from "react";
import { Burger } from "./Burger";
import { Items } from "./Items";
import { placeStyle } from "./place";
import s from "./SwipeTabs.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Swipe Tabs: a scrolling tab strip with a sliding underline over swipeable pages. */
export function SwipeTabs({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [cur, setCur] = useState(0);
  const pages = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [line, setLine] = useState({ x: 0, w: 0 });

  useEffect(() => {
    const b = tabs.current[cur];
    if (!b) return;
    const id = requestAnimationFrame(() => {
      setLine({ x: b.offsetLeft, w: b.offsetWidth });
      b.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [cur, open]);

  const go = (i: number) => {
    setCur(i);
    pages.current?.scrollTo({
      left: i * pages.current.clientWidth,
      behavior: "smooth",
    });
  };
  const onScroll = () => {
    const el = pages.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== cur) setCur(i);
  };

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <nav
        className={`${s.wrap} fx-blur`}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <div className={s.strip} role="tablist">
          {groups.map((g, i) => (
            <button
              key={g.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              aria-selected={i === cur}
              className={s.st}
              tabIndex={open ? 0 : -1}
              onClick={() => go(i)}
            >
              {g.label}
            </button>
          ))}
          <span
            className={s.ul}
            style={{
              transform: `translateX(${line.x}px) scaleX(${line.w / 100})`,
            }}
          />
        </div>
        <div className={s.pages} ref={pages} onScroll={onScroll}>
          {groups.map((g) => (
            <section key={g.id} className={s.pg}>
              <h2>{g.label}</h2>
              <Items
                group={g}
                path={path}
                className={s.mi}
                iconClass="size-5 text-accent"
                tabbable={open}
              />
            </section>
          ))}
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
