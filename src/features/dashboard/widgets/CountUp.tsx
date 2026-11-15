"use client";

import { useEffect, useState } from "react";
import s from "./CountUp.module.css";

/**
 * Rolling numbers (post-launch A5 "odometer"): each digit is a wheel of 0–9 that rolls to its
 * value, from zero when it first appears and from the old value when it changes. Transform
 * only; the server HTML has the real number, screen readers hear it whole, and low-tier
 * phones and Reduce Motion get it without the roll.
 */
export function CountUp({
  value,
  ms = 900,
  decimals = 0,
}: {
  value: number;
  ms?: number;
  decimals?: number;
}) {
  const text = Number.isFinite(value) ? value.toFixed(decimals) : "–";
  // "rest" = the real digits (as rendered on the server); "zero" = wheels at 0, no motion.
  const [phase, setPhase] = useState<"rest" | "zero" | "roll">("rest");
  useEffect(() => {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.tier === "low"
    )
      return;
    let raf = requestAnimationFrame(() => {
      setPhase("zero");
      raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setPhase("roll")),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const chars = [...text];
  let digitIndex = chars.filter((c) => /\d/.test(c)).length;
  return (
    <span className={s.roll} role="img" aria-label={text}>
      {chars.map((ch, i) => {
        // Keyed from the right, so wheels keep their place when the number gains a digit.
        const key = chars.length - i;
        if (!/\d/.test(ch))
          return (
            <span key={key} className={s.ch} aria-hidden>
              {ch}
            </span>
          );
        digitIndex -= 1;
        const d = phase === "zero" ? 0 : Number(ch);
        return (
          <span key={key} className={s.wheel} aria-hidden>
            <span
              className={s.col}
              style={{
                transform: `translateY(${-d * 10}%)`,
                transitionDuration: phase === "roll" ? `${ms}ms` : "0ms",
                transitionDelay:
                  phase === "roll" ? `${digitIndex * 60}ms` : "0ms",
              }}
            >
              {"0123456789".split("").map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
            {/* Holds the wheel's width to the real digit's. */}
            <span className={s.sizer}>{ch}</span>
          </span>
        );
      })}
    </span>
  );
}
