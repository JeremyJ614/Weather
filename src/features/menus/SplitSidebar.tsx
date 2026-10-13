"use client";

import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { Burger } from "./Burger";
import { Items } from "./Items";
import { isLeft, placeStyle } from "./place";
import s from "./SplitSidebar.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Split Sidebar: sections on one side, their pages beside them. */
export function SplitSidebar({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState(groups[0]?.id);
  const g = groups.find((x) => x.id === sel) ?? groups[0];
  const side = isLeft(placement.id) ? "left" : "right";
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-side={side}
    >
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={s.pane}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <div className={s.cols}>
          {groups.map((x) => (
            <button
              key={x.id}
              className={s.cb}
              aria-label={x.label}
              aria-pressed={x.id === g.id}
              tabIndex={open ? 0 : -1}
              onClick={() => setSel(x.id)}
            >
              <NavIcon name={x.icon} />
            </button>
          ))}
        </div>
        <div className={s.list}>
          <p className={s.h}>{g.label}</p>
          <p className={s.count}>
            {g.pages.length} page{g.pages.length > 1 ? "s" : ""}
          </p>
          <div key={g.id} className={s.inner}>
            <Items group={g} path={path} className={s.mi} tabbable={open} />
          </div>
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
