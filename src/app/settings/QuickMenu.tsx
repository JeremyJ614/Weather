"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Lock, X, Zap } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { useViewer } from "@/features/account/useViewer";
import { KEYS } from "@/lib/prefs-keys";
import { MAIN_NAV, ALL_PAGES } from "@/lib/nav/registry";
import { PINNABLE, QUICK_FIXED, QUICK_MAX, cleanQuick } from "@/lib/nav/quick";
import s from "./Settings.module.css";

/** Account Settings → Quick Menu: pin up to eight pages next to the storm chasing pages. */
export function QuickMenu({ onSave }: { onSave: (quick: string[]) => void }) {
  const { isAdmin, locked = [] } = useViewer();
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setPins(
          cleanQuick(JSON.parse(localStorage.getItem(KEYS.quick) || "[]")),
        );
      } catch {}
    });
  }, []);
  const set = (next: string[]) => {
    setPins(next);
    onSave(next);
  };
  const page = (slug: string) => ALL_PAGES.find((p) => p.slug === slug)!;
  const fixed = QUICK_FIXED.map(page).filter(
    (p) => !locked.includes(p.slug) && (isAdmin || !p.adminOnly),
  );
  const move = (i: number, d: number) => {
    const next = [...pins];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };
  const full = pins.length >= QUICK_MAX;
  return (
    <section className={s.card} aria-labelledby="quick-h">
      <header>
        <Zap aria-hidden />
        <h2 id="quick-h">Quick Menu</h2>
        <small>
          {pins.length}/{QUICK_MAX} pinned
        </small>
      </header>
      <p className={s.muted}>
        Your second menu. The storm chasing pages are always in it; pin any
        other pages you open often. Quick Capsule and Edge Peek are made for a
        short list like this.
      </p>
      <fieldset className={s.group}>
        <legend>Always included</legend>
        <ul className={s.pins}>
          {fixed.map((p) => (
            <li key={p.slug}>
              <NavIcon name={p.icon} className="size-4" />
              <span>{p.label}</span>
              <Lock aria-label="Always included" />
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset className={s.group}>
        <legend>Your pins</legend>
        {pins.length ? (
          <ol className={s.pins}>
            {pins.map((slug, i) => (
              <li key={slug}>
                <NavIcon name={page(slug).icon} className="size-4" />
                <span>{page(slug).label}</span>
                <button
                  type="button"
                  aria-label={`Move ${page(slug).label} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${page(slug).label} down`}
                  disabled={i === pins.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Unpin ${page(slug).label}`}
                  onClick={() => set(pins.filter((x) => x !== slug))}
                >
                  <X aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.muted}>Nothing pinned yet. Pick pages below.</p>
        )}
      </fieldset>
      {MAIN_NAV.map((g) => {
        const pages = PINNABLE.filter(
          (p) => g.pages.includes(p) && (isAdmin || !p.adminOnly),
        );
        if (!pages.length) return null;
        return (
          <fieldset key={g.id} className={s.group}>
            <legend>{g.label}</legend>
            <div className={s.options}>
              {pages.map((p) => {
                const on = pins.includes(p.slug);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() =>
                      set(
                        on
                          ? pins.filter((x) => x !== p.slug)
                          : [...pins, p.slug],
                      )
                    }
                  >
                    {on ? <Check aria-hidden /> : <NavIcon name={p.icon} />}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </section>
  );
}
