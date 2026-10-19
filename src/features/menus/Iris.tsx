"use client";

import Link from "@/components/IntentLink";
import { ArrowLeft } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { Burger } from "./Burger";
import { entries } from "./Items";
import { placeStyle } from "./place";
import s from "./Iris.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const R = 150;
// Eight aperture blades, each a wedge from the center that swings out around a pivot on
// the rim (the blade's first corner): rotated away, they open a hole from the middle out.
const BLADES = Array.from({ length: 8 }, (_, i) => {
  const a = (i * 45 * Math.PI) / 180;
  const b = ((i * 45 + 52) * Math.PI) / 180;
  const px = 100 + R * Math.cos(a);
  const py = 100 + R * Math.sin(a);
  return {
    d: `M100 100L${px.toFixed(1)} ${py.toFixed(1)}L${(100 + R * Math.cos(b)).toFixed(1)} ${(100 + R * Math.sin(b)).toFixed(1)}Z`,
    origin: `${px.toFixed(1)}px ${py.toFixed(1)}px`,
  };
});

/**
 * Iris: the screen closes like a camera aperture, then its blades swing open to reveal the
 * sections; a section opens to its pages in the same frame. Closing shuts the iris again.
 */
export function Iris({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const items = entries(groups, sel);
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.ov}>
        <svg
          className={s.blades}
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {BLADES.map((b, i) => (
            <path
              key={i}
              d={b.d}
              className={s.blade}
              style={{ transformOrigin: b.origin }}
            />
          ))}
        </svg>
        <nav
          className={s.menu}
          aria-label={role === "main" ? "Main menu" : "Second menu"}
          aria-hidden={!open}
        >
          <p className={s.kicker}>
            {sel ? (
              <button tabIndex={open ? 0 : -1} onClick={() => setSub(null)}>
                <ArrowLeft aria-hidden /> All sections
              </button>
            ) : (
              "StormSync Weather"
            )}
          </p>
          <h2 className={s.title}>{sel ? sel.label : "Where to?"}</h2>
          <div className={s.grid} key={sub ?? "top"}>
            {items.map((it, i) => {
              const body = (
                <>
                  <i>
                    <NavIcon name={it.icon} className="size-6" />
                  </i>
                  <span>{it.label}</span>
                </>
              );
              const st = { ["--i" as string]: i };
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
                  <em>{groups.find((g) => g.id === it.key)?.pages.length}</em>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <Burger
        open={open}
        onClick={() => setOpen(!open)}
        style={placeStyle(placement.id)}
      />
    </div>
  );
}
