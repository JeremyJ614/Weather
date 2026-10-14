"use client";

import Link from "next/link";
import { useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { Beam } from "@/components/ui/Beam";
import { href } from "@/lib/nav/registry";
import s from "./CornerSweep.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

export function CornerSweep({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Closing folds every group, so reopening never flashes old sub-pages ahead of the sweep.
  if (!open && expanded) setExpanded(null);
  const side = placement.id.startsWith("top-left") ? "left" : "right";
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
            >
              {g.label}
            </Link>
          ) : (
            <div key={g.id}>
              <button
                className={s.g}
                style={{ ["--i" as string]: i }}
                aria-expanded={expanded === g.id}
                tabIndex={open ? 0 : -1}
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
              >
                {g.label}
              </button>
              {expanded === g.id && (
                <div className={s.subs}>
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
                        {pg.label}
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
        onClick={() => setOpen(!open)}
      >
        <i />
        <i />
        <i />
      </button>
    </div>
  );
}
