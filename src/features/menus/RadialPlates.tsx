"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Items, single } from "./Items";
import { placeStyle } from "./place";
import s from "./RadialPlates.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Radial Plates: dark plates with bright outlines burst out around the button. */
export function RadialPlates({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState<string | null>(null);
  const n = groups.length;
  const group = groups.find((g) => g.id === sel);
  const toggle = () => {
    setSel(null);
    setOpen(!open);
  };
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={`${s.bg} fx-blur`} onClick={toggle} />
      <nav
        className={s.wheel}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {groups.map((g, i) => {
          const one = single(g);
          const st = {
            ["--a" as string]: `${(360 / n) * i}deg`,
            ["--i" as string]: i,
          };
          const inner = (
            <>
              <NavIcon name={g.icon} className="size-6" />
              <small>{g.label}</small>
            </>
          );
          return one ? (
            <Link
              key={g.id}
              href={href(one)}
              className={s.pl}
              style={st}
              tabIndex={open ? 0 : -1}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={g.id}
              className={s.pl}
              style={st}
              data-sel={sel === g.id}
              tabIndex={open ? 0 : -1}
              onClick={() => setSel(sel === g.id ? null : g.id)}
            >
              {inner}
            </button>
          );
        })}
      </nav>
      {group && (
        <div className={s.its}>
          <p className={s.cap}>{group.label}</p>
          <Items group={group} path={path} className={s.mi} />
        </div>
      )}
      <button
        className={s.main}
        style={placeStyle(placement.id, 64)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Menu className="size-7" aria-hidden />
      </button>
    </div>
  );
}
