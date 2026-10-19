"use client";

import Link from "next/link";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import s from "./CurtainReveal.module.css";
import { Items, single } from "./Items";
import { isLeft, placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";
import { usePush } from "./usePush";

/** Curtain Reveal: the page swings open like a door onto a big typographic menu. */
export function CurtainReveal({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub: exp, setSub: setExp } = useMenuNav(role);
  const side = isLeft(placement.id) ? "left" : "right";
  usePush("curtain", open, side);
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-side={side}
    >
      <div className={s.catch} onClick={() => setOpen(false)} />
      <nav
        className={s.back}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {groups.map((g, i) => {
          const one = single(g);
          const st = { ["--i" as string]: i };
          return one ? (
            <Link
              key={g.id}
              href={href(one)}
              className={s.g}
              style={st}
              tabIndex={open ? 0 : -1}
              aria-current={path === href(one) ? "page" : undefined}
            >
              {g.label}
            </Link>
          ) : (
            <div key={g.id}>
              <button
                className={s.g}
                style={st}
                aria-expanded={exp === g.id}
                tabIndex={open ? 0 : -1}
                onClick={() => setExp(exp === g.id ? null : g.id)}
              >
                {g.label}
              </button>
              {exp === g.id && (
                <div className={s.subs}>
                  <Items group={g} path={path} className={s.mi} />
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <Burger
        open={open}
        onClick={() => setOpen(!open)}
        style={placeStyle(placement.id)}
      />
    </div>
  );
}
