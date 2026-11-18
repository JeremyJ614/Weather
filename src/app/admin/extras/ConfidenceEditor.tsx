"use client";

import { useState, useTransition } from "react";
import { EXTRAS_ITEMS } from "@/lib/extras/items";
import {
  CONF_COLORS,
  CONF_LEVELS,
  EXPERIMENTAL,
  type Confidence,
} from "@/lib/engines/confidence";
import { saveConfidence } from "./actions";

const box =
  "min-h-10 rounded-xl border border-line bg-surface px-3 text-sm text-text";
const HEX = /^#[0-9a-f]{6}$/i;

/** One tag as the engines show it, without the moving outline. */
function Tag({ color, text }: { color: string; text: string }) {
  return (
    <span
      className="inline-flex min-h-7 items-center rounded-lg px-3 text-[10.5px] font-black tracking-[0.16em] uppercase"
      style={{
        color,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 12px -3px ${color}`,
        textShadow: `0 0 8px ${color}`,
        background: "#05070d",
      }}
    >
      {text}
    </span>
  );
}

/**
 * Admin → Extras → Engine confidence (Fix It List #36, 1): each engine's level and each
 * level's color by hex code. The engine explainers' Confidence tags follow both.
 */
export function ConfidenceEditor({ initial }: { initial: Confidence }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const engines = EXTRAS_ITEMS.filter((i) => i.group === "engines");
  const setColor = (i: number, c: string) =>
    setV((o) => ({
      ...o,
      colors: o.colors.map((x, j) => (j === i ? c : x)),
    }));
  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="eyebrow">Engine confidence</h2>
      <p className="text-sm text-muted">
        Every engine&apos;s explainer carries the red{" "}
        <Tag color={EXPERIMENTAL} text="Experimental" /> tag and a Confidence
        tag. Set each level&apos;s color by hex code (the outline and the words
        both change) and each engine&apos;s level.
      </p>
      <ul className="grid gap-2">
        {CONF_LEVELS.map((label, i) => (
          <li key={label} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Tag color={v.colors[i]} text={`Confidence: ${label}`} />
            <span className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${label} color`}
                className="h-10 w-12 rounded-lg border border-line bg-surface"
                value={HEX.test(v.colors[i]) ? v.colors[i] : CONF_COLORS[i]}
                onChange={(e) => setColor(i, e.target.value)}
              />
              <input
                className={`${box} w-28 font-mono`}
                aria-label={`${label} hex code`}
                value={v.colors[i]}
                maxLength={7}
                onChange={(e) => setColor(i, e.target.value.trim())}
              />
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={() => setColor(i, CONF_COLORS[i])}
              >
                Reset
              </button>
            </span>
          </li>
        ))}
      </ul>
      <ul className="grid gap-2">
        {engines.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-sm font-bold text-text">{e.name}</span>
            <select
              className={box}
              aria-label={`${e.name} confidence`}
              value={v.levels[e.id] ?? 0}
              onChange={(x) =>
                setV((o) => ({
                  ...o,
                  levels: { ...o.levels, [e.id]: Number(x.target.value) },
                }))
              }
            >
              {CONF_LEVELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="min-h-11 rounded-full border px-5 text-sm font-bold text-accent"
          style={{ borderColor: "var(--lit-line)" }}
          disabled={pending || v.colors.some((c) => !HEX.test(c))}
          onClick={() =>
            start(async () => {
              const r = await saveConfidence(v);
              setMsg(r.error ?? "Saved. The engines show it within a minute.");
            })
          }
        >
          {pending ? "Saving…" : "Save confidence"}
        </button>
        {msg && (
          <p className="text-sm text-muted" role="status">
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}
