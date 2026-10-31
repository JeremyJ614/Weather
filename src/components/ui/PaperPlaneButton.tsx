"use client";

import { useEffect, useRef } from "react";
import s from "./PaperPlaneButton.module.css";

type Frame = {
  to: Record<string, number | string>;
  duration: number;
  delay?: number;
  /** Values set the moment this step ends. */
  then?: Record<string, number | string>;
};

/** Tweens an element's CSS variables through steps (numbers ease; anything else switches). */
function run(el: HTMLElement, frames: Frame[]) {
  let stop = false;
  const read = (k: string) =>
    parseFloat(
      el.style.getPropertyValue(k) || getComputedStyle(el).getPropertyValue(k),
    );
  const ease = (t: number) => 1 - (1 - t) * (1 - t);
  const play = async () => {
    for (const f of frames) {
      if (f.delay) await new Promise((r) => setTimeout(r, f.delay! * 1000));
      const from = Object.fromEntries(
        Object.entries(f.to).map(([k, v]) => [
          k,
          typeof v === "number" ? read(k) : v,
        ]),
      );
      for (const [k, v] of Object.entries(f.to))
        if (typeof v !== "number") el.style.setProperty(k, v);
      await new Promise<void>((done) => {
        const t0 = performance.now();
        const step = (now: number) => {
          if (stop) return done();
          const t = Math.min(1, (now - t0) / (f.duration * 1000));
          for (const [k, v] of Object.entries(f.to))
            if (typeof v === "number") {
              const a = from[k] as number;
              el.style.setProperty(k, String(a + (v - a) * ease(t)));
            }
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      if (f.then)
        for (const [k, v] of Object.entries(f.then))
          el.style.setProperty(k, String(v));
      if (stop) return;
    }
  };
  return { done: play(), stop: () => (stop = true) };
}

/** The flight: the original's keyframes (GSAP there, our own small tween here). */
const SHAPE: Frame[] = [
  {
    to: {
      "--left-wing-first-x": 50,
      "--left-wing-first-y": 100,
      "--right-wing-second-x": 50,
      "--right-wing-second-y": 100,
    },
    duration: 0.2,
    then: {
      "--left-wing-first-y": 0,
      "--left-wing-second-x": 40,
      "--left-wing-second-y": 100,
      "--left-wing-third-x": 0,
      "--left-wing-third-y": 100,
      "--left-body-third-x": 40,
      "--right-wing-first-x": 50,
      "--right-wing-first-y": 0,
      "--right-wing-second-x": 60,
      "--right-wing-second-y": 100,
      "--right-wing-third-x": 100,
      "--right-wing-third-y": 100,
      "--right-body-third-x": 60,
    },
  },
  {
    to: {
      "--left-wing-third-x": 20,
      "--left-wing-third-y": 90,
      "--left-wing-second-y": 90,
      "--left-body-third-y": 90,
      "--right-wing-third-x": 80,
      "--right-wing-third-y": 90,
      "--right-body-third-y": 90,
      "--right-wing-second-y": 90,
    },
    duration: 0.2,
  },
  {
    to: {
      "--rotate": 50,
      "--left-wing-third-y": 95,
      "--left-wing-third-x": 27,
      "--right-body-third-x": 45,
      "--right-wing-second-x": 45,
      "--right-wing-third-x": 60,
      "--right-wing-third-y": 83,
    },
    duration: 0.25,
  },
  { to: { "--rotate": 55, "--plane-x": -8, "--plane-y": 24 }, duration: 0.2 },
  {
    to: {
      "--rotate": 40,
      "--plane-x": 45,
      "--plane-y": -180,
      "--plane-opacity": 0,
    },
    duration: 0.3,
  },
];
const PAINT: Frame[] = [
  {
    to: {
      "--text-opacity": 0,
      "--border-radius": 0,
      "--left-wing-background": "var(--paper-darkest)",
      "--right-wing-background": "var(--paper-darkest)",
    },
    duration: 0.1,
  },
  {
    to: {
      "--left-wing-background": "var(--paper)",
      "--right-wing-background": "var(--paper)",
    },
    duration: 0.1,
  },
  {
    to: {
      "--left-body-background": "var(--paper-dark)",
      "--right-body-background": "var(--paper-darkest)",
    },
    duration: 0.4,
  },
  {
    to: { "--success-opacity": 1, "--success-scale": 1 },
    duration: 0.25,
    delay: 0.25,
  },
];

/**
 * A submit button that folds into a paper plane and flies off when the form is sent (owner's
 * follow-up list #2). `flight` counts sends: each new value plays the flight once, then
 * `onLanded` fires (at once with reduced motion). `reset` puts the button back (an error).
 */
export function PaperPlaneButton({
  label,
  sent = "Sent",
  flight,
  reset,
  onLanded,
  disabled,
}: {
  label: string;
  sent?: string;
  flight: number;
  reset?: number;
  onLanded?: () => void;
  disabled?: boolean;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const landed = useRef(onLanded);
  useEffect(() => {
    landed.current = onLanded;
  });
  useEffect(() => {
    const el = btn.current;
    if (!flight || !el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      landed.current?.();
      return;
    }
    box.current?.setAttribute("data-active", "true");
    const a = run(el, SHAPE);
    const b = run(el, PAINT);
    Promise.all([a.done, b.done]).then(() => landed.current?.());
    return () => {
      a.stop();
      b.stop();
    };
  }, [flight]);
  useEffect(() => {
    if (!reset) return;
    btn.current?.removeAttribute("style");
    box.current?.removeAttribute("data-active");
  }, [reset]);
  return (
    <span ref={box} className={s.wrap}>
      <button ref={btn} type="submit" className={s.button} disabled={disabled}>
        <span className={s.label}>{label}</span>
        <span className={s.success} aria-hidden>
          {sent}
        </span>
        <span className={s.left} aria-hidden />
        <span className={s.right} aria-hidden />
      </button>
    </span>
  );
}
