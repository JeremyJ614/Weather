"use client";

import { useState, useTransition } from "react";
import {
  EXTRAS_ITEMS,
  ITEM_STATES,
  stateOf,
  type ExtrasStates,
  type ItemState,
} from "@/lib/extras/items";
import { setExtrasItem } from "./actions";

const LABEL: Record<ItemState, string> = {
  on: "On",
  off: "Off",
  hidden: "Hidden",
  page: "Own page",
};
const GROUPS = [
  { id: "engines", label: "Weather Engines" },
  { id: "randoms", label: "Randoms" },
] as const;

/** Admin → Extras: every engine and Random, each On, Off (listed, greyed), Hidden or on its Own page. */
export function ExtrasSwitches({ initial }: { initial: ExtrasStates }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, state: ItemState) =>
    start(async () => {
      const r = await setExtrasItem(id, state);
      if (r.error) setErr(r.error);
      else {
        setErr(null);
        setItems((x) => ({ ...x, [id]: state }));
      }
    });
  return (
    <div className="grid gap-5">
      {err && (
        <p role="alert" className="text-sm text-accent">
          {err}
        </p>
      )}
      {GROUPS.map((g) => (
        <section key={g.id} className="grid gap-2">
          <h2 className="eyebrow">{g.label}</h2>
          <ul className="grid gap-2">
            {EXTRAS_ITEMS.filter((i) => i.group === g.id).map((i) => {
              const now = stateOf(items, i.id);
              return (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
                >
                  <span className="grid min-w-0 flex-1">
                    <b>{i.name}</b>
                    {now === "page" && (
                      <a
                        href={`/${i.slug}`}
                        className="truncate text-xs text-accent"
                      >
                        weather.sswx.space/{i.slug}
                      </a>
                    )}
                  </span>
                  <span
                    role="radiogroup"
                    aria-label={`${i.name}: on, off, hidden or its own page`}
                    className="flex flex-wrap gap-1"
                  >
                    {ITEM_STATES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        role="radio"
                        aria-checked={now === st}
                        disabled={pending}
                        onClick={() => now !== st && set(i.id, st)}
                        className={`min-h-9 rounded-full border px-3 text-sm font-bold ${now === st ? "border-[var(--lit-line)] bg-[var(--lit)] text-accent" : "border-line text-muted"}`}
                      >
                        {LABEL[st]}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
