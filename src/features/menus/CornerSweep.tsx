"use client";

import { useState } from "react";
import Link from "@/components/IntentLink";
import { NavIcon } from "@/components/NavIcon";
import { Beam } from "@/components/ui/Beam";
import { href } from "@/lib/nav/registry";
import s from "./CornerSweep.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

export function CornerSweep({ groups, placement, role }: MenuProps) {
  const {
    open,
    setOpen,
    path,
    sub: expanded,
    setSub: setExpanded,
  } = useMenuNav(role);
  const side = placement.id.startsWith("top-left") ? "left" : "right";
  // Opening shows the current page's section, so its struck-through line is in view.
  const here = groups.find((g) => g.pages.some((pg) => href(pg) === path));
  // Opened that way, its pages wait for the sweep and the headings.
  const [auto, setAuto] = useState(false);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={`${s.lay} ${s.l1}`} data-side={side} />
      <div className={`${s.lay} ${s.l2}`} data-side={side} />
      <nav
        className={s.list}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {groups.map((g, i) =>
          g.pages.length === 1 ? (
            <Link
              key={g.id}
              href={href(g.pages[0])}
              className={s.g}
              style={{ ["--i" as string]: i }}
              tabIndex={open ? 0 : -1}
              aria-current={path === href(g.pages[0]) ? "page" : undefined}
            >
              <span className={s.strike}>{g.label}</span>
            </Link>
          ) : (
            <div key={g.id}>
              <button
                className={s.g}
                style={{ ["--i" as string]: i }}
                aria-expanded={expanded === g.id}
                data-here={here?.id === g.id || undefined}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  setAuto(false);
                  setExpanded(expanded === g.id ? null : g.id);
                }}
              >
                {g.label}
              </button>
              {expanded === g.id && (
                <div className={s.subs} data-auto={auto || undefined}>
                  {g.pages.map((pg, k) => (
                    <Beam
                      key={pg.slug}
                      className={s.beam}
                      still={
                        path === href(pg)
                          ? undefined
                          : (["edge", "fade", "under"] as const)[k % 3]
                      }
                    >
                      <Link
                        href={href(pg)}
                        className={s.mi}
                        style={{ ["--i" as string]: k }}
                        aria-current={path === href(pg) ? "page" : undefined}
                      >
                        <NavIcon
                          name={pg.icon}
                          className="size-4 text-accent"
                        />
                        <span className={s.strike}>{pg.label}</span>
                      </Link>
                    </Beam>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </nav>
      <button
        className={s.trig}
        data-side={side}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => {
          if (!open && here && here.pages.length > 1) {
            setExpanded(here.id);
            setAuto(true);
          }
          setOpen(!open);
        }}
      >
        <i />
        <i />
        <i />
      </button>
    </div>
  );
}
