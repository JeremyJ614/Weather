"use client";

import { useState, useTransition } from "react";
import { saveDeerSeasons, type DeerSeasons as Value } from "./actions";

const RUT: [keyof Value["rut"], string][] = [
  ["pre", "Pre-rut starts"],
  ["peak", "Peak starts"],
  ["post", "Post-rut starts"],
  ["end", "Rut ends"],
];
const box =
  "min-h-10 rounded-xl border border-line bg-surface px-3 text-sm text-text";

/** Admin → Extras → Deer Activity: the state's seasons and rut dates. */
export function DeerSeasons({ initial }: { initial: Value }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const season = (i: number, k: "name" | "start" | "end", x: string) =>
    setV((o) => ({
      ...o,
      seasons: o.seasons.map((s, j) => (j === i ? { ...s, [k]: x } : s)),
    }));
  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="eyebrow">Deer Activity: seasons and rut</h2>
      <p className="text-sm text-muted">
        Shown with each place&apos;s outlook (&ldquo;Season today&rdquo;). Check
        them against the state&apos;s hunting regulations each year.
      </p>
      <label className="grid gap-1 text-sm text-muted">
        State
        <input
          className={box}
          value={v.state}
          onChange={(e) => setV({ ...v, state: e.target.value })}
        />
      </label>
      <ul className="grid gap-2">
        {v.seasons.map((s, i) => (
          <li key={i} className="flex flex-wrap items-end gap-2">
            <input
              aria-label="Season"
              className={`${box} min-w-0 flex-1`}
              value={s.name}
              onChange={(e) => season(i, "name", e.target.value)}
            />
            <input
              aria-label={`${s.name} opens`}
              type="date"
              className={box}
              value={s.start}
              onChange={(e) => season(i, "start", e.target.value)}
            />
            <input
              aria-label={`${s.name} closes`}
              type="date"
              className={box}
              value={s.end}
              onChange={(e) => season(i, "end", e.target.value)}
            />
            <button
              type="button"
              className="min-h-10 rounded-xl border border-line px-3 text-sm text-muted"
              onClick={() =>
                setV({ ...v, seasons: v.seasons.filter((_, j) => j !== i) })
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="min-h-10 justify-self-start rounded-xl border border-line px-3 text-sm"
        onClick={() =>
          setV({
            ...v,
            seasons: [...v.seasons, { name: "", start: "", end: "" }],
          })
        }
      >
        Add a season
      </button>
      <div className="grid grid-cols-2 gap-2">
        {RUT.map(([k, label]) => (
          <label key={k} className="grid gap-1 text-sm text-muted">
            {label} (MM-DD)
            <input
              className={box}
              value={v.rut[k]}
              onChange={(e) =>
                setV({ ...v, rut: { ...v.rut, [k]: e.target.value } })
              }
            />
          </label>
        ))}
      </div>
      {msg && (
        <p role="status" className="text-sm text-accent">
          {msg}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        className="min-h-11 justify-self-start rounded-xl border border-[var(--lit-line)] px-4 text-sm font-bold text-accent"
        onClick={() =>
          start(async () => {
            const r = await saveDeerSeasons(v);
            setMsg(r.error ?? "Saved.");
          })
        }
      >
        {pending ? "Saving…" : "Save seasons"}
      </button>
    </section>
  );
}
