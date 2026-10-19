"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/IntentLink";
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontalEnd,
  Undo2,
} from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import f from "./Fab.module.css";
import { single } from "./Items";
import { fabPlace } from "./place";
import s from "./FlipDeck.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const STEP = 150;

/**
 * Flip Deck: shortcuts dealt as a 3D deck of cards. Swipe or tap the arrows to bring one to
 * the front; tap it to open. A section's card flips over to show its pages on the back.
 */
export function FlipDeck({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const router = useRouter();
  const [at, setAt] = useState(0);
  const [flip, setFlip] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  // A swipe ends with a click on whatever card is under the finger; that click is ignored.
  const swiped = useRef(false);
  const n = groups.length;
  const go = (i: number) => {
    setFlip(null);
    setAt(Math.max(0, Math.min(n - 1, i)));
  };
  if (!open && flip) setFlip(null);
  const onDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, id: e.pointerId, moved: false };
    swiped.current = false;
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || flip) return;
    const x = e.clientX - d.x;
    if (!d.moved && Math.abs(x) > 8) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(d.id);
    }
    if (d.moved) setDx(x);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    swiped.current = !!d?.moved;
    if (d?.moved) {
      go(at - Math.round(dx / STEP));
      setDx(0);
    }
  };
  const pick = (i: number) => {
    if (swiped.current) return;
    if (i !== at) return go(i);
    const g = groups[i];
    const one = single(g);
    if (one) {
      setOpen(false);
      router.push(href(one));
    } else setFlip(flip === g.id ? null : g.id);
  };

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <nav
        className={s.stage}
        aria-label={role === "main" ? "Main menu" : "Quick menu"}
        aria-hidden={!open}
      >
        <div
          className={s.deck}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          data-drag={dx !== 0 || undefined}
        >
          {groups.map((g, i) => {
            const rel = i - at + dx / STEP;
            const far = Math.abs(rel);
            const one = single(g);
            const flipped = flip === g.id;
            return (
              <div
                key={g.id}
                className={s.slot}
                style={{
                  transform: `translate3d(${rel * 128}px, 0, ${-far * 140}px) rotateY(${-Math.max(-1, Math.min(1, rel)) * 42}deg)`,
                  opacity: far > 2.4 ? 0 : 1,
                  zIndex: 100 - Math.round(far * 10),
                  pointerEvents: far > 2.4 ? "none" : undefined,
                }}
              >
                <div
                  className={s.card}
                  data-flipped={flipped || undefined}
                  data-front={i === at || undefined}
                  style={{ ["--i" as string]: Math.abs(i - at) }}
                >
                  <button
                    className={s.face}
                    tabIndex={open && !flipped ? 0 : -1}
                    aria-label={
                      i === at
                        ? one
                          ? `Open ${one.label}`
                          : `Show ${g.label}`
                        : `Move to ${one?.label ?? g.label}`
                    }
                    onClick={() => pick(i)}
                  >
                    <i>
                      <NavIcon name={one?.icon ?? g.icon} className="size-8" />
                    </i>
                    <b>{one?.label ?? g.label}</b>
                    <small>
                      {one
                        ? path === href(one)
                          ? "You're here"
                          : "Tap to open"
                        : `${g.pages.length} pages · tap to flip`}
                    </small>
                  </button>
                  {!one && (
                    <div className={s.back} aria-hidden={!flipped}>
                      <p>
                        {g.label}
                        <button
                          aria-label="Flip back"
                          tabIndex={flipped ? 0 : -1}
                          onClick={() => setFlip(null)}
                        >
                          <Undo2 aria-hidden />
                        </button>
                      </p>
                      <div className={s.pages}>
                        {g.pages.map((pg) => (
                          <Link
                            key={pg.slug}
                            href={href(pg)}
                            tabIndex={flipped ? 0 : -1}
                            aria-current={
                              path === href(pg) ? "page" : undefined
                            }
                          >
                            <NavIcon name={pg.icon} className="size-4" />
                            <span>{pg.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className={s.nav}>
          <button
            aria-label="Previous"
            tabIndex={open ? 0 : -1}
            disabled={at === 0}
            onClick={() => go(at - 1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <span className={s.dots} aria-hidden>
            {groups.map((g, i) => (
              <i key={g.id} data-on={i === at || undefined} />
            ))}
          </span>
          <button
            aria-label="Next"
            tabIndex={open ? 0 : -1}
            disabled={at === n - 1}
            onClick={() => go(at + 1)}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
      </nav>
      <button
        className={`${f.fab} ${fabPlace(placement.id, f)} ${s.trig}`}
        aria-label={open ? "Close quick menu" : "Open quick menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <GalleryHorizontalEnd aria-hidden />
      </button>
    </div>
  );
}
