"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { single } from "./Items";
import s from "./EdgePeek.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Edge Peek: a glowing tab on the screen's edge; pull it and a short stack of cards slides out. */
export function EdgePeek({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const left = placement.id.startsWith("left");
  const sel = groups.find((g) => g.id === sub);
  const items = sel
    ? sel.pages.map((pg) => ({
        key: pg.slug,
        label: pg.label,
        icon: pg.icon,
        to: href(pg),
      }))
    : groups.map((g) => {
        const one = single(g);
        return {
          key: g.id,
          label: one?.label ?? g.label,
          icon: one?.icon ?? g.icon,
          to: one ? href(one) : null,
        };
      });
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-left={left}
    >
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={s.stack}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
        key={sub ?? "top"}
      >
        <small className={s.title}>{sel ? sel.label : "Quick menu"}</small>
        {sel && (
          <button
            className={s.card}
            style={{ ["--i" as string]: 0 }}
            onClick={() => setSub(null)}
            tabIndex={open ? 0 : -1}
          >
            <i>
              <ArrowLeft aria-hidden />
            </i>
            <span>Back</span>
          </button>
        )}
        {items.map((it, n) => {
          const i = n + (sel ? 1 : 0);
          const body = (
            <>
              <i>
                <NavIcon name={it.icon} className="size-5" />
              </i>
              <span>{it.label}</span>
            </>
          );
          return it.to ? (
            <Link
              key={it.key}
              href={it.to}
              className={s.card}
              style={{ ["--i" as string]: i }}
              tabIndex={open ? 0 : -1}
              aria-current={path === it.to ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={it.key}
              className={s.card}
              style={{ ["--i" as string]: i }}
              tabIndex={open ? 0 : -1}
              onClick={() => setSub(it.key)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <button
        className={s.tab}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronLeft aria-hidden />
      </button>
    </div>
  );
}
