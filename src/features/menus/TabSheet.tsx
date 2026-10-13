"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";
import { Items, single } from "./Items";
import s from "./TabSheet.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

interface Tab {
  key: string;
  label: string;
  icon: string;
  groups: NavGroup[];
}

/** Bottom tabs for the first four sections plus More; a sliding light marks the tab. */
export function toTabs(groups: NavGroup[]): Tab[] {
  const t = (g: NavGroup): Tab => ({
    key: g.id,
    label: g.label.split(" ")[0],
    icon: g.icon,
    groups: [g],
  });
  if (groups.length <= 5) return groups.map(t);
  return [
    ...groups.slice(0, 4).map(t),
    { key: "more", label: "More", icon: "LayoutGrid", groups: groups.slice(4) },
  ];
}

export function TabSheet({ groups, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const tabs = toTabs(groups);
  const [cur, setCur] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [light, setLight] = useState({ x: 0, w: 0 });
  const active = tabs.find((t) => t.key === cur);
  const sheetOpen = open && !!active;

  useLayoutEffect(() => {
    const el = cur ? refs.current[cur] : null;
    if (el) setLight({ x: el.offsetLeft + 6, w: el.offsetWidth - 12 });
  }, [cur]);

  return (
    <div data-menu-role={role} className={sheetOpen ? s.on : undefined}>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <div className={s.sheet} aria-hidden={!sheetOpen}>
        {active?.groups.map((g) => (
          <div key={g.id}>
            <p className={s.h}>{g.label}</p>
            <Items
              group={g}
              path={path}
              className={s.mi}
              tabbable={sheetOpen}
            />
          </div>
        ))}
      </div>
      <nav
        className={`${s.bar} fx-blur`}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        <span
          className={s.light}
          style={{
            transform: `translateX(${light.x}px) scaleX(${light.w / 100})`,
            opacity: cur ? 1 : 0,
          }}
        />
        {tabs.map((t) => {
          const one = t.groups.length === 1 ? single(t.groups[0]) : null;
          const body = (
            <>
              <NavIcon name={t.icon} className="size-[22px]" />
              <span>{t.label}</span>
            </>
          );
          return one ? (
            <Link
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              href={href(one)}
              className={s.tb}
              aria-current={path === href(one) ? "page" : undefined}
              onClick={() => setCur(t.key)}
            >
              {body}
            </Link>
          ) : (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[t.key] = el;
              }}
              className={s.tb}
              aria-pressed={cur === t.key && open}
              onClick={() => {
                const same = cur === t.key && open;
                setCur(t.key);
                setOpen(!same);
              }}
            >
              {body}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
