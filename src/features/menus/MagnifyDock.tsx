"use client";

import { useRef, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/IntentLink";
import { LayoutGrid } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { entries, type Entry } from "./Items";
import s from "./MagnifyDock.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const SLOTS = 7;
const REACH = 120;

/**
 * Magnify Dock: a glass dock of shortcuts along the bottom. Slide a finger (or the pointer)
 * across it and the icons swell under it like a desktop dock; lift on one to open it. A
 * section or the overflow opens a small panel of its pages above the dock.
 */
export function MagnifyDock({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const router = useRouter();
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, x0: 0, hot: -1 });
  const top = entries(groups);
  const shown = top.length > SLOTS ? top.slice(0, SLOTS - 1) : top;
  const rest = top.length > SLOTS ? top.slice(SLOTS - 1) : [];
  const dock: (Entry & { more?: boolean })[] = rest.length
    ? [...shown, { key: "more", label: "More", icon: "", to: null, more: true }]
    : shown;
  const sel = groups.find((g) => g.id === sub);
  const panel: Entry[] =
    sub === "more" ? rest : sel ? entries(groups, sel) : [];

  // Scales are written straight to the icons on each frame, never through React state.
  const swell = (x: number | null) => {
    const icons = bar.current?.querySelectorAll<HTMLElement>("[data-dock]");
    let hot = -1;
    let best = 0;
    icons?.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = x === null ? Infinity : Math.abs(r.left + r.width / 2 - x);
      const k = Math.max(0, 1 - d / REACH);
      const sc = 1 + 0.75 * k * k;
      el.style.transform = `translate3d(0, ${-(sc - 1) * 26}px, 0) scale(${sc})`;
      el.toggleAttribute("data-hot", k > 0.82);
      if (k > best) {
        best = k;
        hot = i;
      }
    });
    drag.current.hot = best > 0.5 ? hot : -1;
  };
  const activate = (it: Entry & { more?: boolean }) => {
    if (it.to) {
      setOpen(false);
      router.push(it.to);
    } else {
      setSub(it.key);
      setOpen(true);
    }
  };
  const onDown = (e: PointerEvent) => {
    drag.current = { down: true, moved: false, x0: e.clientX, hot: -1 };
    if (e.pointerType !== "mouse")
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    swell(e.clientX);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && !drag.current.down) return;
    if (Math.abs(e.clientX - drag.current.x0) > 10) drag.current.moved = true;
    swell(e.clientX);
  };
  const onUp = () => {
    const { moved, hot } = drag.current;
    drag.current.down = false;
    swell(null);
    // A slide that ends on an icon opens it; a plain tap is handled by the icon itself.
    if (moved && hot >= 0) activate(dock[hot]);
  };

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={`${s.panel} ${placement.id.endsWith("-raised") ? s.up : ""}`}
        aria-label={sel ? sel.label : "More shortcuts"}
        aria-hidden={!open}
        key={sub ?? "none"}
      >
        <p className={s.title}>{sel ? sel.label : "More"}</p>
        <div className={s.grid}>
          {panel.map((it, i) =>
            it.to ? (
              <Link
                key={it.key}
                href={it.to}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
                aria-current={path === it.to ? "page" : undefined}
              >
                <i>
                  <NavIcon name={it.icon} className="size-5" />
                </i>
                <span>{it.label}</span>
              </Link>
            ) : (
              <button
                key={it.key}
                style={{ ["--i" as string]: i }}
                tabIndex={open ? 0 : -1}
                onClick={() => setSub(it.key)}
              >
                <i>
                  <NavIcon name={it.icon} className="size-5" />
                </i>
                <span>{it.label}</span>
              </button>
            ),
          )}
        </div>
      </nav>
      <div
        ref={bar}
        className={`${s.dock} ${placement.id.endsWith("-raised") ? s.up : ""}`}
        role="toolbar"
        aria-label="Quick menu"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={(e) => e.pointerType === "mouse" && swell(null)}
      >
        {dock.map((it) => {
          const here = it.to === path;
          const body = (
            <>
              <span className={s.tip}>{it.label}</span>
              {it.more ? (
                <LayoutGrid className="size-5" aria-hidden />
              ) : (
                <NavIcon name={it.icon} className="size-5" />
              )}
            </>
          );
          const click = (e: React.MouseEvent) => {
            if (drag.current.moved) e.preventDefault();
          };
          return it.to ? (
            <Link
              key={it.key}
              href={it.to}
              data-dock=""
              className={s.icon}
              aria-label={it.label}
              aria-current={here ? "page" : undefined}
              onClick={click}
              draggable={false}
            >
              {body}
            </Link>
          ) : (
            <button
              key={it.key}
              data-dock=""
              className={s.icon}
              aria-label={it.label}
              aria-expanded={open && sub === it.key}
              onClick={(e) => {
                click(e);
                if (e.defaultPrevented) return;
                if (open && sub === it.key) setOpen(false);
                else activate(it);
              }}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
