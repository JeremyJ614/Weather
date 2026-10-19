import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The replay clock (Z2 #08).
 *
 * Advancing by the wall-clock delta means a dropped frame advances the storm
 * by the whole gap, so on a struggling device the replay genuinely runs fast
 * and a chase that took four hours finishes in three (B-006). Elapsed time is
 * accumulated instead and spent in fixed steps, so the simulation advances by
 * the same amount per step whatever the frame rate.
 *
 * A long stall — a backgrounded tab, a garbage collection pause — is clamped
 * rather than replayed in one jump, because catching up sixty seconds in one
 * frame teleports every tornado across the map.
 */
const STEP = 1 / 60;
const MAX_CATCHUP = 0.25;

/**
 * Playback speeds, as the owner specified them.
 *
 * The spread is wide on purpose: 1x is what the chase actually felt like, and
 * 750x puts a fifteen-hour drive into about a minute. The gaps between the
 * fast steps are large because at those rates a factor of two is barely
 * perceptible — what matters is being able to reach "the whole day quickly"
 * without stepping through six intermediate speeds to get there.
 *
 * They live here rather than in the page because the clock's starting speed
 * has to be one of them. It was not: the clock opened at 8x, which is on
 * nobody's button, so the transport showed no speed selected and there was no
 * way back to 8x once you left it.
 */
export const SPEEDS = [1, 10, 60, 150, 300, 500, 750] as const;

/** Where the clock starts. Fast enough that something is happening. */
export const DEFAULT_SPEED: (typeof SPEEDS)[number] = 10;

export interface ReplayClock {
  at: number;
  playing: boolean;
  speed: number;
  seek: (to: number) => void;
  toggle: () => void;
  restart: () => void;
  setSpeed: (s: number) => void;
}

export function useClock(
  window_: [number, number],
  initialSpeed: number = DEFAULT_SPEED,
): ReplayClock {
  const [from, to] = window_;
  const [at, setAt] = useState(from);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);

  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const debt = useRef(0);

  // A new day starts at its own beginning, not at the last one's offset.
  // A new window (another event) starts over, paused.
  const [win, setWin] = useState(`${from}:${to}`);
  if (win !== `${from}:${to}`) {
    setWin(`${from}:${to}`);
    setAt(from);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return undefined;
    last.current = performance.now();
    debt.current = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(MAX_CATCHUP, (now - last.current) / 1000);
      last.current = now;
      debt.current += elapsed;

      let advance = 0;
      while (debt.current >= STEP) {
        debt.current -= STEP;
        advance += STEP * speed;
      }

      if (advance > 0) {
        setAt((prev) => {
          const next = prev + advance;
          if (next >= to) {
            setPlaying(false);
            return to;
          }
          return next;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, to]);

  const seek = useCallback(
    (next: number) => {
      setAt(Math.min(to, Math.max(from, next)));
    },
    [from, to],
  );

  return {
    at,
    playing,
    speed,
    seek,
    toggle: useCallback(() => setPlaying((p) => !p), []),
    restart: useCallback(() => {
      setAt(from);
      setPlaying(true);
    }, [from]),
    setSpeed,
  };
}
