"use client";

import { useEffect, useRef, useState } from "react";
import { dayKey } from "./schedule";

const LAST_KEY = "sswx-intro-last";
// The owner's brand line for the intro: gray metal turning periwinkle.
const INTRO_ACCENT = "#9aa8ff";

/**
 * The launch intro. Decides on the client whether to play, loads the 3D code
 * only when it will play, and always gets out of the way: tap to skip, and any
 * failure (no WebGL, slow network) closes it at once.
 */
export function LaunchIntro() {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "playing" | "leaving" | "done">(
    "idle",
  );
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    // The head script already decided (see introBootScript) before first paint.
    if (document.documentElement.dataset.intro !== "play") {
      queueMicrotask(() => setState("done"));
      return;
    }
    try {
      localStorage.setItem(LAST_KEY, dayKey(new Date()));
    } catch {}
    let cancelled = false;
    const finish = () => {
      delete document.documentElement.dataset.intro;
      setState((s) => (s === "done" ? s : "leaving"));
    };
    import("./intro3d.js")
      .then(({ playIntro }) => {
        if (cancelled || !host.current) return;
        const css = getComputedStyle(document.documentElement);
        stop.current = playIntro(
          host.current,
          {
            bg: css.getPropertyValue("--bg").trim() || "#0b0c14",
            metal: css.getPropertyValue("--metal").trim() || "#c9cbd6",
            accent: INTRO_ACCENT,
          },
          { fast: true, onEnd: () => setTimeout(finish, 700) },
        );
      })
      .catch(finish);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "leaving") return;
    const t = setTimeout(() => {
      stop.current?.();
      stop.current = null;
      setState("done");
    }, 450);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "done") return null;
  return (
    <div
      id="launch-intro"
      role="dialog"
      aria-label="StormSync Media intro. Tap to skip."
      onClick={() => {
        delete document.documentElement.dataset.intro;
        setState("leaving");
      }}
      className="fixed inset-0 z-[100] cursor-pointer bg-bg transition-opacity duration-[450ms] ease-[var(--ease)]"
      style={{ opacity: state === "leaving" ? 0 : 1 }}
    >
      <div ref={host} className="absolute inset-0" />
      <span className="mono pointer-events-none absolute left-3 bottom-[calc(10px+env(safe-area-inset-bottom,0px))] text-[10px] uppercase tracking-[0.14em] text-muted">
        Tap to skip
      </span>
    </div>
  );
}
