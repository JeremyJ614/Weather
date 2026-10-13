"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import s from "./GlassLedger.module.css";
import { Items, single } from "./Items";
import { placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Glass Ledger: a glass bottom sheet; one section open at a time, pages as an icon grid. */
export function GlassLedger({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <button
        className={s.launch}
        style={placeStyle(placement.id, 120)}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" aria-hidden /> Menu
      </button>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={`${s.sheet} fx-blur`}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <div className={s.grab} />
        {groups.map((g) => {
          const one = single(g);
          if (one)
            return (
              <Link
                key={g.id}
                href={href(one)}
                className={s.sh}
                tabIndex={open ? 0 : -1}
              >
                <NavIcon name={g.icon} />
                <span>{g.label}</span>
              </Link>
            );
          const isOpen = sel === g.id;
          return (
            <div key={g.id} className={s.sec} data-open={isOpen}>
              <button
                className={s.sh}
                aria-expanded={isOpen}
                tabIndex={open ? 0 : -1}
                onClick={() => setSel(isOpen ? null : g.id)}
              >
                <NavIcon name={g.icon} />
                <span>{g.label}</span>
                <ChevronDown className={s.chev} aria-hidden />
              </button>
              <div className={s.body}>
                <div>
                  {isOpen && (
                    <Items
                      group={g}
                      path={path}
                      className={s.mi}
                      iconClass="size-5 text-accent"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
