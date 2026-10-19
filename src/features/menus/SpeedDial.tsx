"use client";

import Link from "@/components/IntentLink";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";
import { placeStyle, isLeft } from "./place";
import s from "./SpeedDial.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Speed Dial: labelled buttons unstack from the FAB; a section's pages replace the stack. */
export function SpeedDial({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState<NavGroup | null>(null);
  const left = isLeft(placement.id);
  const fab = placeStyle(placement.id, 60);
  const stackPos = { ...fab, bottom: `calc(${String(fab.bottom)} + 74px)` };
  const close = () => {
    setSel(null);
    setOpen(false);
  };
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-left={left}
    >
      <div className={s.scrim} onClick={close} />
      <nav
        key={sel?.id ?? "top"}
        className={s.stack}
        style={stackPos}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {!sel &&
          groups.map((g, i) =>
            g.pages.length === 1 ? (
              <Link
                key={g.id}
                href={href(g.pages[0])}
                className={s.db}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
              >
                <span>{g.label}</span>
                <i>
                  <NavIcon name={g.icon} className="size-5" />
                </i>
              </Link>
            ) : (
              <button
                key={g.id}
                className={s.db}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
                onClick={() => setSel(g)}
              >
                <span>{g.label}</span>
                <i>
                  <NavIcon name={g.icon} className="size-5" />
                </i>
              </button>
            ),
          )}
        {sel && (
          <>
            <button
              className={`${s.db} ${s.back}`}
              style={{ ["--i" as string]: 0 }}
              onClick={() => setSel(null)}
            >
              <span>Back</span>
              <i>
                <ArrowLeft className="size-5" aria-hidden />
              </i>
            </button>
            {sel.pages.map((pg, i) => (
              <Link
                key={pg.slug}
                href={href(pg)}
                className={s.db}
                style={{ ["--i" as string]: i + 1 }}
                aria-current={path === href(pg) ? "page" : undefined}
              >
                <span>{pg.label}</span>
                <i>
                  <NavIcon name={pg.icon} className="size-5" />
                </i>
              </Link>
            ))}
          </>
        )}
      </nav>
      <button
        className={s.fab}
        style={fab}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Plus className="size-7" aria-hidden />
      </button>
    </div>
  );
}
