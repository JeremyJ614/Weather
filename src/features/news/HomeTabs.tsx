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

type Tab = { id: string; label: string; panel: ReactNode; icon?: ReactNode };

const nextFrame = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );

/**
 * Subtabs. Switching morphs the panel through a noise dissolve (the shared
 * WebGL overlay). Panels render on first open and stay mounted (maps keep state).
 * `underline`: a fixed multicolor rule that keeps its colors in every theme.
 * `segment`: a dark segmented control whose active pill carries the beam.
 * `pills`: a sideways-scrolling row of dark pills (second-level tabs).
 */
export function HomeTabs({
  tabs,
  label = "Sections",
  variant = "underline",
}: {
  tabs: Tab[];
  label?: string;
  variant?: "underline" | "segment" | "pills";
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
    const show = () => {
      setActive(id);
      setSeen((x) => new Set(x).add(id));
    };
    if (!wrap.current || !morphEnabled()) return show();
    busy.current = true;
    const dir = to > index ? 1 : -1;
    const before = visible(wrap.current);
    await morphCover(before, dir);
    flushSync(show);
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
              : s.underline
        }
        style={
          variant === "pills"
            ? undefined
            : { gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }
        }
      >
        {variant === "pills" ? null : variant === "segment" ? (
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
          variant === "pills" && t.id === active ? (
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
            className={s.panel}
          >
            {seen.has(t.id) ? t.panel : null}
          </div>
        ))}
      </div>
    </div>
  );
}
