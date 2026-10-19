"use client";

import Link from "@/components/IntentLink";
import { ArrowLeft } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import { Items, single } from "./Items";
import s from "./LiveBento.module.css";
import { placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const FX: Record<string, string> = {
  severe: s.flash,
  tools: s.sweep,
  specialty: s.twinkle,
  local: s.spin,
  home: s.pulse,
  community: s.pulse,
  account: s.pulse,
};

/** Live Bento: every tile is alive; picking one zooms it to full screen. */
export function LiveBento({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub: sel, setSub: setSel } = useMenuNav(role);
  const g = groups.find((x) => x.id === sel);
  const toggle = () => {
    setSel(null);
    setOpen(!open);
  };
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <nav
        className={s.board}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {groups.map((x) => {
          const one = single(x);
          const body = (
            <>
              <span className={`${s.fx} ${FX[x.id] ?? s.float}`}>
                <NavIcon name={x.icon} className="size-11" />
              </span>
              <small>
                {x.pages.length} PAGE{x.pages.length > 1 ? "S" : ""}
              </small>
              <b>{x.label}</b>
            </>
          );
          return one ? (
            <Link
              key={x.id}
              href={href(one)}
              className={s.t}
              tabIndex={open ? 0 : -1}
            >
              {body}
            </Link>
          ) : (
            <button
              key={x.id}
              className={s.t}
              tabIndex={open ? 0 : -1}
              onClick={() => setSel(x.id)}
            >
              {body}
            </button>
          );
        })}
      </nav>
      <div className={s.zoom} data-open={!!g}>
        {g && (
          <>
            <p className={s.h}>
              <button
                aria-label="Back to sections"
                onClick={() => setSel(null)}
              >
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              {g.label}
            </p>
            <Items
              group={g}
              path={path}
              className={s.mi}
              iconClass="size-5 text-accent"
            />
          </>
        )}
      </div>
      <Burger open={open} onClick={toggle} style={placeStyle(placement.id)} />
    </div>
  );
}
