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
 * Orb Constellation (main menu, owner's list #41): one luminous orb opens a dark stage where
 * every section floats in as its own glowing orb. Tap one and it takes the top of the stage,
 * its pages rising beneath it as smaller orbs whose names slide out beside them.
 */
export function OrbConstellation({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const list = entries(groups, sel);
  const tones = glows(list.map((e) => e.key));
  const selTone = sel
    ? glows(groups.map((g) => g.id))[groups.indexOf(sel)]
    : "";
  const tab = open ? 0 : -1;
  const orb = (icon: string, g: string, extra = "") => (
    <i className={`${s.orb} ${extra}`} style={{ "--g": g } as CSSProperties}>
      <NavIcon name={icon} />
      <b className={s.halo} aria-hidden />
    </i>
  );

  return (
    <div className={`${s.root} ${open ? s.on : ""}`} data-menu-role={role}>
      <div className={s.backdrop} onClick={() => setOpen(false)} aria-hidden />
      <nav
        className={s.stage}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <div className={s.title}>
          {sel ? (
            <>
              <button
                type="button"
                className={s.item}
                onClick={() => setSub(null)}
                tabIndex={tab}
                aria-label="Back to all sections"
              >
                <i className={`${s.orb} ${s.back}`}>
                  <ArrowLeft />
                  <b className={s.halo} aria-hidden />
                </i>
              </button>
              {orb(sel.icon, selTone, s.hero)}
              <div>
                <p>Section</p>
                <h2>{sel.label}</h2>
              </div>
            </>
          ) : (
            <div>
              <p>SSWX Weather Center</p>
              <h2>Where to?</h2>
            </div>
          )}
        </div>
        <div className={sel ? s.list : s.field} key={sub ?? "top"}>
          {list.map((e, i) => {
            const style = { "--i": i } as CSSProperties;
            const inner = (
              <>
                {orb(e.icon, tones[i])}
                <span className={sel ? s.label : undefined}>{e.label}</span>
              </>
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
        </div>
      </nav>
      <button
        type="button"
        className={`${s.trig} ${s.item}`}
        style={placeStyle(placement.id, 58)}
        aria-label={open ? "Close menu" : "Open menu"}
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
