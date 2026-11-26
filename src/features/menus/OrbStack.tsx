"use client";

import Link from "@/components/IntentLink";
import type { CSSProperties } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { entries, groupOf } from "./Items";
import { glows } from "./orbGlow";
import { placeStyle } from "./place";
import s from "./Orbs.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/**
 * Orb Stack (quick menu, owner's list #41): a single orb in the corner. Tap it and a column of
 * luminous orbs rises above it, each name sliding out in a lit pill beside its orb; a section
 * swaps the column for its pages, with a silver orb to go back.
 */
export function OrbStack({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const list = entries(groups, sel);
  const tones = glows(list.map((e) => e.key));
  const side = placement.id.includes("left")
    ? "left"
    : placement.id.includes("center")
      ? "center"
      : "right";
  const tab = open ? 0 : -1;
  const at = placeStyle(placement.id, 56);
  // The column stands on the orb: same side, 70 px higher.
  const stackAt: CSSProperties = {
    ...at,
    bottom: `calc(${String(at.bottom ?? "16px")} + 64px)`,
    ...(side === "center" && { left: "50%", transform: "translateX(-50%)" }),
  };
  // Nearest the orb first: the list runs bottom to top.
  const rows = sel
    ? [{ key: "__back", label: "Back", icon: "", to: null }, ...list]
    : list;
  const n = rows.length;

  return (
    <div className={open ? s.qon : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.stack}
        style={stackAt}
        data-side={side}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
        key={sub ?? "top"}
      >
        {rows.map((e, i) => {
          // Stagger from the orb upward.
          const style = {
            "--j": n - 1 - i,
            "--g":
              e.key === "__back" ? "180, 195, 210" : tones[i - (sel ? 1 : 0)],
          } as CSSProperties;
          const inner = (
            <>
              <span className={s.pill}>{e.label}</span>
              <i className={s.orb}>
                {e.key === "__back" ? <ArrowLeft /> : <NavIcon name={e.icon} />}
                <b className={s.halo} aria-hidden />
              </i>
            </>
          );
          if (e.key === "__back")
            return (
              <button
                key={e.key}
                type="button"
                className={s.item}
                style={style}
                tabIndex={tab}
                onClick={() => setSub(null)}
              >
                {inner}
              </button>
            );
          return e.to ? (
            <Link
              key={e.key}
              href={e.to}
              className={s.item}
              style={style}
              tabIndex={tab}
              aria-current={path === e.to ? "page" : undefined}
            >
              {inner}
            </Link>
          ) : (
            <button
              key={e.key}
              type="button"
              className={s.item}
              style={style}
              tabIndex={tab}
              data-here={here?.id === e.key || undefined}
              onClick={() => setSub(e.key)}
            >
              {inner}
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className={`${s.qtrig} ${s.item}`}
        style={at}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <i className={s.orb}>
          <Plus />
          <b className={s.halo} aria-hidden />
        </i>
      </button>
    </div>
  );
}
