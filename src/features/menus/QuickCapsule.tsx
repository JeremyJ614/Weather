"use client";

import Link from "next/link";
import { ArrowLeft, X, Zap } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { placeStyle, isLeft } from "./place";
import { single } from "./Items";
import s from "./QuickCapsule.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/** Quick Capsule: the button stretches into a glass capsule of icon shortcuts; made for a few pages. */
export function QuickCapsule({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const left = isLeft(placement.id);
  const pos = placeStyle(placement.id, 56);
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
        className={s.capsule}
        style={{ bottom: pos.bottom }}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
      >
        <small className={s.title}>{sel ? sel.label : "Quick menu"}</small>
        <div className={s.row} key={sub ?? "top"}>
          {sel && (
            <button
              className={s.item}
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
                className={s.item}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
                aria-current={path === it.to ? "page" : undefined}
              >
                {body}
              </Link>
            ) : (
              <button
                key={it.key}
                className={s.item}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
                onClick={() => setSub(it.key)}
              >
                {body}
              </button>
            );
          })}
        </div>
      </nav>
      <button
        className={s.fab}
        style={pos}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Zap className={s.zap} aria-hidden />
        <X className={s.x} aria-hidden />
      </button>
    </div>
  );
}
