"use client";

import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Beam } from "@/components/ui/Beam";
import {
  morphCover,
  morphEnabled,
  morphReveal,
  visible,
} from "@/features/motion/morph";
import s from "./HomeTabs.module.css";

type Tab = {
  id: string;
  label: string;
  panel: ReactNode;
  icon?: ReactNode;
  /** One-line caption under the label (arcade cards). */
  sub?: string;
};

const nextFrame = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );

/**
 * Every switch slides the new panel in through the Web Animations API, so it runs on
 * every phone (CSS animations are zeroed under reduced motion). Reduced motion gets
 * an opacity-only fade, which is safe for motion sensitivity.
 */
function slideIn(el: Element | null | undefined, dir: number) {
  if (!el || typeof el.animate !== "function") return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.animate(
    calm
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          {
            opacity: 0,
            transform: `translate3d(${dir * 28}px, 0, 0) scale(.985)`,
          },
          { opacity: 1, transform: "none" },
        ],
    {
      duration: calm ? 240 : 420,
      easing: "cubic-bezier(.2,.8,.2,1)",
    },
  );
}

/**
 * Subtabs. Switching morphs the panel through a noise dissolve (the shared
 * WebGL overlay). Panels render on first open and stay mounted (maps keep state).
 * `underline`: a fixed multicolor rule that keeps its colors in every theme.
 * `segment`: a dark segmented control whose active pill carries the beam.
 * `pills`: a sideways-scrolling row of dark pills (second-level tabs).
 * `arcade`: big cards; the active one wears a spinning multicolor rim.
 */
export function HomeTabs({
  tabs,
  label = "Sections",
  variant = "underline",
}: {
  tabs: Tab[];
  label?: string;
  variant?: "underline" | "segment" | "pills" | "arcade";
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [seen, setSeen] = useState(() => new Set([tabs[0]?.id]));
  const wrap = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  const select = async (id: string) => {
    if (id === active || busy.current) return;
    const to = tabs.findIndex((t) => t.id === id);
    const dir = to > index ? 1 : -1;
    const show = () => {
      flushSync(() => {
        setActive(id);
        setSeen((x) => new Set(x).add(id));
      });
      slideIn(wrap.current?.querySelector(`#panel-${id}`), dir);
    };
    if (!wrap.current || !morphEnabled()) return show();
    busy.current = true;
    const before = visible(wrap.current);
    await morphCover(before, dir);
    show();
    await nextFrame();
    const after = visible(wrap.current);
    const top = Math.min(before.top, after.top);
    const bottom = Math.max(before.bottom, after.bottom);
    await morphReveal(
      new DOMRect(after.left, top, after.width, bottom - top),
      dir,
    );
    busy.current = false;
  };

  const w = `${100 / tabs.length}%`;
  const shift = `translateX(${index * 100}%)`;
  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label={label}
        className={
          variant === "segment"
            ? s.segment
            : variant === "pills"
              ? s.pills
              : variant === "arcade"
                ? s.arcade
                : s.underline
        }
        style={
          variant === "pills" || variant === "arcade"
            ? undefined
            : { gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }
        }
      >
        {variant === "pills" || variant === "arcade" ? null : variant ===
          "segment" ? (
          <Beam
            className={s.pill}
            style={{
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 3,
              width: `calc(${w} - 6px)`,
              transform: shift,
            }}
            strength={0.9}
          >
            <span className={s.pillFill} />
          </Beam>
        ) : (
          <span
            aria-hidden
            className={s.rule}
            style={{ width: w, transform: shift }}
          />
        )}
        {tabs.map((t) =>
          variant === "arcade" ? (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === active}
              aria-controls={`panel-${t.id}`}
              onClick={() => select(t.id)}
              className={s.card}
            >
              <span className={s.cardSpin} aria-hidden />
              <span className={s.cardBody}>
                <span className={s.cardIcon}>{t.icon}</span>
                <b>{t.label}</b>
                {t.sub && <small>{t.sub}</small>}
              </span>
            </button>
          ) : variant === "pills" && t.id === active ? (
            <Beam key={t.id} className={s.pillBeam}>
              <button
                role="tab"
                id={`tab-${t.id}`}
                aria-selected
                aria-controls={`panel-${t.id}`}
                className={s.tab}
              >
                {t.icon}
                {t.label}
              </button>
            </Beam>
          ) : (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === active}
              aria-controls={`panel-${t.id}`}
              onClick={() => select(t.id)}
              className={s.tab}
            >
              {t.icon}
              {t.label}
            </button>
          ),
        )}
      </div>
      <div ref={wrap}>
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`panel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={t.id !== active}
          >
            {seen.has(t.id) ? t.panel : null}
          </div>
        ))}
      </div>
    </div>
  );
}
