"use client";

import { useEffect, useRef } from "react";

/** A number that counts up to its value once (text only; respects reduced motion). */
export function CountUp({ value, ms = 900 }: { value: number; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(value);
      return;
    }
    const from = 0;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - (1 - k) ** 3;
      el.textContent = String(Math.round(from + (value - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span ref={ref}>{value}</span>;
}
