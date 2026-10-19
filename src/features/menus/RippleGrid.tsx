"use client";

import Link from "@/components/IntentLink";
import { ArrowLeft, Waves } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import f from "./Fab.module.css";
import { entries } from "./Items";
import { fabPlace } from "./place";
import s from "./RippleGrid.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/**
 * Ripple Grid: tapping the button sends rings rippling across the screen, and the shortcut
 * tiles land with the wave, nearest first. A section's tile ripples its pages in.
 */
export function RippleGrid({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const items = entries(groups, sel);
  const left = placement.id.includes("left");
  const center = placement.id.includes("center");
  const tiles = sel ? items.length + 1 : items.length;
  const rows = Math.ceil(tiles / 3);
  // How far a tile is from the button, in tiles: the wave reaches it in that order.
  const delay = (k: number) => {
    const r = rows - 1 - Math.floor(k / 3);
    const c = k % 3;
    const cd = center ? Math.abs(c - 1) : left ? c : 2 - c;
    return `${Math.hypot(r, cd) * 70 + 120}ms`;
  };
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-side={center ? "center" : left ? "left" : "right"}
      data-raised={placement.id.endsWith("-raised") || undefined}
    >
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <span className={s.rings} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <nav
        className={s.grid}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
        key={sub ?? "top"}
      >
        {sel && (
          <button
            className={`${s.tile} ${s.back}`}
            style={{ ["--d" as string]: delay(0) }}
            tabIndex={open ? 0 : -1}
            onClick={() => setSub(null)}
          >
            <i>
              <ArrowLeft className="size-5" aria-hidden />
            </i>
            <span>{sel.label}</span>
          </button>
        )}
        {items.map((it, n) => {
          const k = n + (sel ? 1 : 0);
          const body = (
            <>
              <i>
                <NavIcon name={it.icon} className="size-5" />
              </i>
              <span>{it.label}</span>
              {!it.to && (
                <em>{groups.find((g) => g.id === it.key)?.pages.length}</em>
              )}
            </>
          );
          const st = { ["--d" as string]: delay(k) };
          return it.to ? (
            <Link
              key={it.key}
              href={it.to}
              className={s.tile}
              style={st}
              tabIndex={open ? 0 : -1}
              aria-current={path === it.to ? "page" : undefined}
            >
              {body}
            </Link>
          ) : (
            <button
              key={it.key}
              className={s.tile}
              style={st}
              tabIndex={open ? 0 : -1}
              onClick={() => setSub(it.key)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <button
        className={`${f.fab} ${fabPlace(placement.id, f)} ${s.trig}`}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Waves aria-hidden />
      </button>
    </div>
  );
}
