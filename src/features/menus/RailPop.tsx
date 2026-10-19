"use client";

import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Items, single } from "./Items";
import s from "./RailPop.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Bottom Rail Pop: a thumb-height rail; one section's panel pops up at a time. */
export function RailPop({ groups, role }: MenuProps) {
  const { open, setOpen, path, sub: sel, setSub: setSel } = useMenuNav(role);
  const g = open ? groups.find((x) => x.id === sel) : undefined;
  return (
    <div data-menu-role={role}>
      <div className={`${s.pop} fx-blur`} data-open={!!g} aria-hidden={!g}>
        {g && (
          <>
            <p className={s.h}>{g.label}</p>
            <div className={s.gr}>
              <Items group={g} path={path} className={s.mi} />
            </div>
          </>
        )}
      </div>
      <nav
        className={s.rl}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
      >
        {groups.map((x) => {
          const one = single(x);
          const body = (
            <>
              <NavIcon name={x.icon} className="size-[22px]" />
              <span>{x.label.split(" ")[0]}</span>
            </>
          );
          return one ? (
            <Link
              key={x.id}
              href={href(one)}
              className={s.rb}
              aria-current={path === href(one) ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={x.id}
              className={s.rb}
              aria-pressed={!!g && g.id === x.id}
              onClick={() => {
                const same = open && sel === x.id;
                setSel(x.id);
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
