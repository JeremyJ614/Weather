"use client";

import Link from "@/components/IntentLink";
import { ArrowLeft, Radar, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import f from "./Fab.module.css";
import { entries } from "./Items";
import { fabPlace } from "./place";
import s from "./RadarScope.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/**
 * Radar Scope: a radar screen opens with a sweeping beam; every shortcut is a blip that
 * lights up as the beam passes. A section's blip re-plots the scope with its pages.
 */
export function RadarScope({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const items = entries(groups, sel);
  // Up to 7 on the outer ring and 3 on an inner one; longer lists are listed under the scope.
  const ringed = items.length <= 10 ? items : [];
  const outer = Math.min(ringed.length, 7);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={s.wrap}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
      >
        <div className={s.scope} key={sub ?? "top"}>
          <svg viewBox="0 0 200 200" className={s.grid} aria-hidden>
            {[96, 72, 48, 24].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} />
            ))}
            <path d="M100 4V196M4 100H196M32 32L168 168M168 32L32 168" />
          </svg>
          <span className={s.beam} aria-hidden />
          {ringed.map((it, i) => {
            const inner = i >= outer;
            const n = inner ? ringed.length - outer : outer;
            const k = inner ? i - outer : i;
            const a =
              ((k / n) * 360 + (inner ? 180 / n : 0) - 90) * (Math.PI / 180);
            const r = inner ? 21 : 38;
            const x = 50 + r * Math.cos(a);
            const y = 50 + r * Math.sin(a);
            const body = (
              <>
                <i>
                  <NavIcon name={it.icon} className="size-4" />
                </i>
                <span>{it.label}</span>
              </>
            );
            const style = {
              left: `${x}%`,
              top: `${y}%`,
              ["--i" as string]: i,
              // The beam reaches each blip at its own moment.
              ["--d" as string]: `${(((k / n) * 360 + (inner ? 180 / n : 0)) / 360) * 4}s`,
            };
            const cls = s.blip;
            return it.to ? (
              <Link
                key={it.key}
                href={it.to}
                className={cls}
                style={style}
                tabIndex={open ? 0 : -1}
                aria-current={path === it.to ? "page" : undefined}
              >
                {body}
              </Link>
            ) : (
              <button
                key={it.key}
                className={cls}
                style={style}
                tabIndex={open ? 0 : -1}
                onClick={() => setSub(it.key)}
              >
                {body}
              </button>
            );
          })}
          <button
            className={s.hub}
            tabIndex={open ? 0 : -1}
            onClick={() => (sel ? setSub(null) : setOpen(false))}
            aria-label={sel ? "Back" : "Close quick menu"}
          >
            {sel ? <ArrowLeft aria-hidden /> : <X aria-hidden />}
            <small>{sel ? sel.label : "Quick"}</small>
          </button>
        </div>
        {!ringed.length && (
          <div className={s.list}>
            {items.map((it, i) =>
              it.to ? (
                <Link
                  key={it.key}
                  href={it.to}
                  style={{ ["--i" as string]: i }}
                  tabIndex={open ? 0 : -1}
                  aria-current={path === it.to ? "page" : undefined}
                >
                  <NavIcon name={it.icon} className="size-4" />
                  <span>{it.label}</span>
                </Link>
              ) : (
                <button
                  key={it.key}
                  style={{ ["--i" as string]: i }}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setSub(it.key)}
                >
                  <NavIcon name={it.icon} className="size-4" />
                  <span>{it.label}</span>
                </button>
              ),
            )}
          </div>
        )}
      </nav>
      <button
        className={`${f.fab} ${fabPlace(placement.id, f)} ${s.trig}`}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Radar aria-hidden />
      </button>
    </div>
  );
}
