"use client";

import { useEffect, useRef } from "react";

/** A number that counts up to its value once (text only; respects reduced motion). */
export function CountUp({
  value,
  ms = 900,
  decimals = 0,
}: {
  value: number;
  ms?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = value.toFixed(decimals);
      return;
    }
    const from = 0;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - (1 - k) ** 3;
      el.textContent = (from + (value - from) * e).toFixed(decimals);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, decimals]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}
