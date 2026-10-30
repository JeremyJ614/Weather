"use client";

import { useState } from "react";
import s from "./RefreshKey.module.css";

/** Two arrows chasing round: the key's symbol (drawn twice: red at rest, purple pressed). */
const Arrows = ({ className }: { className: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 21v-5h-5" />
  </svg>
);

/**
 * A refresh button styled as a lit keyboard key (Fix list 2026-10-30 #1). `fresh` lights its
 * LED and shows a "New data" marker; `busy` holds it pressed, purple and spinning.
 */
export function RefreshKey({
  onPress,
  busy = false,
  fresh = false,
  label = "Refresh",
  className = "",
}: {
  onPress: () => void;
  busy?: boolean;
  fresh?: boolean;
  label?: string;
  className?: string;
}) {
  const [pulse, setPulse] = useState(0);
  return (
    <div
      className={`${s.wrap} ${className}`}
      data-busy={busy}
      data-fresh={fresh}
    >
      {fresh && !busy && (
        <span className={s.tag} role="status">
          <i aria-hidden /> New data
        </span>
      )}
      <button
        type="button"
        className={s.key}
        aria-label={fresh ? `${label}: new data is ready` : label}
        aria-busy={busy}
        onClick={() => {
          setPulse((n) => n + 1);
          onPress();
        }}
      >
        <span className={s.glow} aria-hidden />
        <span className={s.press} aria-hidden />
        <span className={s.inner} aria-hidden>
          <Arrows className={s.symbol} />
          <Arrows className={s.symbolOn} />
        </span>
        <span className={s.corner} aria-hidden />
        <span className={s.led} aria-hidden />
        <span className={s.ledOn} aria-hidden />
        <span className={s.ledBusy} aria-hidden />
        {pulse > 0 && <span key={pulse} className={s.burst} aria-hidden />}
      </button>
    </div>
  );
}
