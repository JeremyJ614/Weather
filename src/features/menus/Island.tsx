"use client";

import Link from "@/components/IntentLink";
import { useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { flatPages } from "./Items";
import s from "./Island.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const PILL_W = 156;
const PILL_H = 46;

/**
 * Island: a live pill (it shows the page you're on) morphs into a full panel: search every
 * page, or tap one of your quick pages. The panel grows out of the pill and folds back into
 * it on close.
 */
export function Island({ groups, placement, role, all }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [q, setQ] = useState("");
  const shell = useRef<HTMLDivElement>(null);
  const side = placement.id.includes("left")
    ? "left"
    : placement.id.includes("center")
      ? "center"
      : "right";
  const raised = placement.id.endsWith("-raised");
  const pool = flatPages(all?.length ? all : groups);
  const now = pool.find((p) => p.to === path);
  const hits = q.trim()
    ? pool
        .filter((p) =>
          `${p.label} ${p.group}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
        )
        .filter((p, i, a) => a.findIndex((x) => x.to === p.to) === i)
        .slice(0, 12)
    : null;

  // The panel's closed scale is the pill's size against its own, measured as it changes.
  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const set = () => {
      el.style.setProperty(
        "--sx",
        String(PILL_W / Math.max(1, el.offsetWidth)),
      );
      el.style.setProperty(
        "--sy",
        String(PILL_H / Math.max(1, el.offsetHeight)),
      );
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tab = open ? 0 : -1;
  return (
    <div
      className={open ? s.on : undefined}
      data-menu-role={role}
      data-side={side}
      data-raised={raised || undefined}
    >
      <div
        className={s.ov}
        onClick={() => {
          setOpen(false);
          setQ("");
        }}
        aria-hidden
      />
      <div className={s.shell} ref={shell}>
        <nav
          className={s.body}
          aria-label={role === "main" ? "Main menu" : "Second menu"}
          aria-hidden={!open}
        >
          <div className={s.top}>
            <p>
              <i aria-hidden />
              {now ? (
                <>
                  Now · <b>{now.label}</b>
                </>
              ) : (
                <b>Quick</b>
              )}
            </p>
            <button
              className={s.x}
              aria-label="Close menu"
              tabIndex={tab}
              onClick={() => {
                setOpen(false);
                setQ("");
              }}
            >
              <X aria-hidden />
            </button>
          </div>
          <label className={s.search}>
            <Search aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search every page"
              aria-label="Search every page"
              tabIndex={tab}
              enterKeyHint="go"
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits?.[0])
                  (e.currentTarget.form ?? document)
                    .querySelector<HTMLAnchorElement>(`.${s.hit}`)
                    ?.click();
              }}
            />
          </label>
          {hits ? (
            <ul className={s.hits}>
              {hits.length ? (
                hits.map((h, i) => (
                  <li key={h.key} style={{ ["--i" as string]: i }}>
                    <Link
                      href={h.to}
                      className={s.hit}
                      tabIndex={tab}
                      aria-current={path === h.to ? "page" : undefined}
                    >
                      <NavIcon name={h.icon} className={s.ic} />
                      <span>{h.label}</span>
                      <small>{h.group}</small>
                    </Link>
                  </li>
                ))
              ) : (
                <li className={s.none}>No page matches “{q.trim()}”.</li>
              )}
            </ul>
          ) : (
            groups.map((g, gi) => (
              <section
                key={g.id}
                className={s.group}
                style={{ ["--g" as string]: gi }}
              >
                <h3>{g.label}</h3>
                <div className={s.grid}>
                  {g.pages.map((pg, i) => (
                    <Link
                      key={pg.slug}
                      href={href(pg)}
                      className={s.tile}
                      style={{ ["--i" as string]: i }}
                      tabIndex={tab}
                      aria-current={path === href(pg) ? "page" : undefined}
                    >
                      <i>
                        <NavIcon name={pg.icon} className="size-5" />
                      </i>
                      <span>{pg.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </nav>
      </div>
      <button
        className={s.pill}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <i aria-hidden />
        <b>Quick</b>
        <span>{now?.label ?? "Pages"}</span>
      </button>
    </div>
  );
}
