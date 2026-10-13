"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Items, single } from "./Items";
import s from "./NotchBar.module.css";
import { toTabs } from "./TabSheet";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Notch Bar: the bar carves a round notch that glides under the active icon. */
export function NotchBar({ groups, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const tabs = toTabs(groups);
  const [cur, setCur] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const mask = useId().replace(/:/g, "");
  const active = tabs[cur];
  const sheetOpen =
    open &&
    active.groups.length > 0 &&
    !(active.groups.length === 1 && single(active.groups[0]));

  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const slot = w / tabs.length;
  const cx = slot * cur + slot / 2;

  return (
    <div data-menu-role={role}>
      <div className={s.sheet} data-open={sheetOpen} aria-hidden={!sheetOpen}>
        {sheetOpen &&
          active.groups.map((g) => (
            <div key={g.id}>
              <p className={s.h}>{g.label}</p>
              <Items group={g} path={path} className={s.mi} />
            </div>
          ))}
      </div>
      <nav
        className={s.bar}
        ref={bar}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
      >
        <svg className={s.bg} aria-hidden>
          <defs>
            <mask id={mask}>
              <rect width="100%" height="100%" rx="20" fill="#fff" />
              <circle
                r="36"
                fill="#000"
                style={{ transform: `translate(${cx}px, 2px)` }}
                className={s.hole}
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" rx="20" mask={`url(#${mask})`} />
        </svg>
        <span
          className={s.bub}
          style={{ transform: `translateX(${cx - 28}px)` }}
        />
        {tabs.map((t, i) => {
          const one = t.groups.length === 1 ? single(t.groups[0]) : null;
          const st = { left: slot * i, width: slot };
          const icon = <NavIcon name={t.icon} className="size-6" />;
          return one ? (
            <Link
              key={t.key}
              href={href(one)}
              className={s.nb}
              style={st}
              data-sel={i === cur}
              aria-label={t.label}
              onClick={() => {
                setCur(i);
                setOpen(false);
              }}
            >
              {icon}
            </Link>
          ) : (
            <button
              key={t.key}
              className={s.nb}
              style={st}
              data-sel={i === cur}
              aria-label={t.label}
              aria-expanded={i === cur && open}
              onClick={() => {
                const same = i === cur && open;
                setCur(i);
                setOpen(!same);
              }}
            >
              {icon}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
