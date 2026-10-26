"use client";

import Link from "@/components/IntentLink";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Command } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { entries, groupOf } from "./Items";
import { fabPlace } from "./place";
import f from "./Fab.module.css";
import s from "./Keycaps.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

/**
 * Keycaps: shortcuts as chunky mechanical keycaps on a tilted metal plate, with a light running
 * under them. Keys press down with real travel; a section's key swaps the plate to its pages.
 * With a keyboard, 1–9 press the keys and 0 goes back.
 */
export function Keycaps({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const router = useRouter();
  const sel = groups.find((g) => g.id === sub);
  const here = groupOf(groups, path);
  const keys = entries(groups, sel);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "0" && sel) return setSub(null);
      const n = Number(e.key);
      if (!(n >= 1 && n <= 9) || !keys[n - 1]) return;
      const k = keys[n - 1];
      if (k.to) router.push(k.to);
      else setSub(k.key);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, keys, sel, setSub, router]);

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} aria-hidden />
      <div className={s.wrap}>
        <nav
          className={s.plate}
          aria-label={role === "main" ? "Main menu" : "Quick menu"}
          aria-hidden={!open}
        >
          <i className={s.led} aria-hidden />
          <p className={s.title}>{sel ? sel.label : "Quick Menu"}</p>
          <div className={s.grid} key={sub ?? "top"}>
            {sel && (
              <button
                className={s.key}
                style={{ ["--i" as string]: 0 }}
                onClick={() => setSub(null)}
                tabIndex={open ? 0 : -1}
              >
                <span className={s.cap}>
                  <em>0</em>
                  <ArrowLeft className={s.ic} aria-hidden />
                  <span>Back</span>
                </span>
              </button>
            )}
            {keys.map((k, n) => {
              const i = n + (sel ? 1 : 0);
              const cap = (
                <span className={s.cap}>
                  {n < 9 && <em>{n + 1}</em>}
                  <NavIcon name={k.icon} className={s.ic} />
                  <span>{k.label}</span>
                </span>
              );
              const style = {
                ["--i" as string]: i,
                ["--glow" as string]:
                  i % 2 ? "var(--accent2)" : "var(--accent)",
              };
              return k.to ? (
                <Link
                  key={k.key}
                  href={k.to}
                  className={s.key}
                  style={style}
                  tabIndex={open ? 0 : -1}
                  aria-current={path === k.to ? "page" : undefined}
                >
                  {cap}
                </Link>
              ) : (
                <button
                  key={k.key}
                  className={s.key}
                  style={style}
                  tabIndex={open ? 0 : -1}
                  data-here={here?.id === k.key || undefined}
                  onClick={() => setSub(k.key)}
                >
                  {cap}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <button
        className={`${s.fab} ${fabPlace(placement.id, f)}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <Command aria-hidden />
        </span>
      </button>
    </div>
  );
}
