"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTier } from "@/features/motion/useTier";
import type { Ctx, Scene, Tier } from "./stage";
import s from "./Randoms.module.css";

/**
 * Mounts one Randoms scene into a box: loads its engine only now, pauses it while it is off
 * screen or the tab is hidden, and tears it down (GPU memory included) on unmount.
 */
export function Stage<S extends Scene>({
  load,
  onReady,
  label,
  shape,
  children,
}: {
  load: (el: HTMLDivElement, ctx: Ctx) => Promise<S>;
  onReady?: (scene: S) => void;
  label: string;
  /** "tall" for scenes that want height; "photo" keeps a 4:3 frame for landscape photos. */
  shape?: "tall" | "photo";
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const tier = useTier() as Tier;
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const loadRef = useRef(load);
  const readyRef = useRef(onReady);
  useEffect(() => {
    loadRef.current = load;
    readyRef.current = onReady;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let scene: S | null = null;
    let gone = false;
    let onScreen = true;
    const sync = () => scene?.pause(!onScreen || document.hidden);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    loadRef
      .current(el, {
        tier,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      })
      .then((sc) => {
        if (gone) return sc.dispose();
        scene = sc;
        sync();
        readyRef.current?.(sc);
        setState("ready");
      })
      .catch(() => !gone && setState("failed"));
    return () => {
      gone = true;
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      scene?.dispose();
    };
  }, [tier]);

  return (
    <div
      ref={box}
      className={s.stage}
      data-shape={shape}
      role="img"
      aria-label={label}
    >
      {state === "loading" && <p className={s.status}>Loading…</p>}
      {state === "failed" && (
        <p className={s.status}>
          This one needs WebGL, which this browser or device has turned off.
        </p>
      )}
      {children}
    </div>
  );
}
