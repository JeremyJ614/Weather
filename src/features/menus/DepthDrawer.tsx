"use client";

import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import s from "./DepthDrawer.module.css";
import { Items, single } from "./Items";
import { isLeft, placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";
import { usePush } from "./usePush";

/** Depth Drawer: the page tilts back in 3D while the drawer slides in. */
export function DepthDrawer({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub: exp, setSub: setExp } = useMenuNav(role);
  const side = isLeft(placement.id) ? "left" : "right";
  usePush("depth", open, side);
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-side={side}
    >
      <div className={s.catch} onClick={() => setOpen(false)} />
      <nav
        className={s.drawer}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <p className={s.k}>StormSync Weather</p>
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
            >
              <NavIcon name={g.icon} className="size-5 text-accent" />
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
                <NavIcon name={g.icon} className="size-5 text-accent" />
                {g.label}
              </button>
              {exp === g.id && (
                <div className={s.subs}>
                  <Items
                    group={g}
                    path={path}
                    className={s.mi}
                    iconClass="size-4"
                  />
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
