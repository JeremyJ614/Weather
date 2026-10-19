"use client";

import Link from "@/components/IntentLink";
import { Plus } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { Beam } from "@/components/ui/Beam";
import { href } from "@/lib/nav/registry";
import s from "./MorphFab.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

export function MorphFab({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const side = placement.id.includes("left")
    ? s.left
    : placement.id.includes("center")
      ? s.center
      : s.right;
  const vert = placement.id.endsWith("-raised") ? s.raised : s.pos;
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={`${s.blob} ${side} ${vert}`} />
      <nav
        className={s.in}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <p className={s.title}>Where to?</p>
        {groups.map((g, i) => (
          <div key={g.id} className={s.sec} style={{ ["--i" as string]: i }}>
            <h2>
              <NavIcon name={g.icon} className="size-3.5" />
              {g.label}
            </h2>
            <div className={s.row}>
              {g.pages.map((pg, k) => (
                <Beam
                  key={pg.slug}
                  className={s.beam}
                  still={
                    path === href(pg)
                      ? undefined
                      : (["edge", "fade", "under"] as const)[k % 3]
                  }
                >
                  <Link
                    href={href(pg)}
                    className={s.mi}
                    tabIndex={open ? 0 : -1}
                    aria-current={path === href(pg) ? "page" : undefined}
                  >
                    {pg.label}
                  </Link>
                </Beam>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <button
        className={`${s.fab} ${side} ${vert}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus className="size-7" aria-hidden />
      </button>
    </div>
  );
}
