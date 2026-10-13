"use client";

import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { Burger } from "./Burger";
import { Items } from "./Items";
import { placeStyle } from "./place";
import s from "./MegaSpotlight.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Mega Spotlight: pick a section, a feature card glows up with its pages below. */
export function MegaSpotlight({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState(groups[0]?.id);
  const g = groups.find((x) => x.id === sel) ?? groups[0];
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <nav
        className={s.panel}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <div className={s.cats}>
          {groups.map((x) => (
            <button
              key={x.id}
              className={s.cb}
              aria-pressed={x.id === g.id}
              tabIndex={open ? 0 : -1}
              onClick={() => setSel(x.id)}
            >
              <NavIcon name={x.icon} className="size-4" />
              {x.label}
            </button>
          ))}
        </div>
        <div className={s.body}>
          <div key={g.id} className={s.hero}>
            <NavIcon name={g.icon} className={s.big} />
            <small>
              {g.pages.length} PAGE{g.pages.length > 1 ? "S" : ""}
            </small>
            <b>{g.label}</b>
          </div>
          <div className={s.grid}>
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
