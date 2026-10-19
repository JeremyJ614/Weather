"use client";

import Link from "@/components/IntentLink";
import { X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import s from "./BentoBoard.module.css";
import { Burger } from "./Burger";
import { Items, single } from "./Items";
import { placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const SPANS = [s.w2, "", "", `${s.w2} ${s.h2}`, "", "", s.w2, "", ""];

/** Bento Board: sections as tiles of different sizes; a tile's pages rise in a sheet. */
export function BentoBoard({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub: sel, setSub: setSel } = useMenuNav(role);
  const g = groups.find((x) => x.id === sel);
  const toggle = () => {
    setSel(null);
    setOpen(!open);
  };
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <nav
        className={`${s.board} fx-blur`}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {groups.map((x, i) => {
          const one = single(x);
          const body = (
            <>
              <NavIcon name={x.icon} className={s.ic} />
              <em>{x.pages.length}</em>
              <b>{x.label}</b>
            </>
          );
          const cls = `${s.t} ${SPANS[i % SPANS.length]}`;
          const st = { ["--i" as string]: i };
          return one ? (
            <Link
              key={x.id}
              href={href(one)}
              className={cls}
              style={st}
              tabIndex={open ? 0 : -1}
            >
              {body}
            </Link>
          ) : (
            <button
              key={x.id}
              className={cls}
              style={st}
              tabIndex={open ? 0 : -1}
              onClick={() => setSel(x.id)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <div className={s.sheet} data-open={!!g}>
        {/* The sheet's backdrop: drifting aurora light, radar rings and the section's emblem. */}
        <div className={s.fx} aria-hidden>
          <i className={s.a1} />
          <i className={s.a2} />
          <i className={s.a3} />
          <svg viewBox="0 0 200 200" className={s.rings}>
            {[90, 66, 42, 18].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} />
            ))}
          </svg>
          <span className={s.sweep} />
          {g && <NavIcon name={g.icon} className={s.mark} />}
        </div>
        {g && (
          <div className={s.body} key={g.id}>
            <span className={s.grab} />
            <p className={s.h}>
              <span>
                <small>
                  {g.pages.length} page{g.pages.length === 1 ? "" : "s"}
                </small>
                {g.label}
              </span>
              <button
                aria-label="Back to sections"
                onClick={() => setSel(null)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </p>
            <div className={s.list}>
              <Items
                group={g}
                path={path}
                className={s.mi}
                iconClass="size-5"
              />
            </div>
          </div>
        )}
      </div>
      <Burger open={open} onClick={toggle} style={placeStyle(placement.id)} />
    </div>
  );
}
