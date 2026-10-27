"use client";

import { useEffect } from "react";
import { demote, tierFromHints, type Tier } from "@/lib/device/tier";

/** Registers the service worker and sets data-tier on <html>. Renders nothing. */
export function DeviceSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      // Says so when the worker showed a saved copy (instant reopen).
      if (navigator.serviceWorker.controller)
        import("@/features/offline/stale").then((m) =>
          m.watchStale(navigator.serviceWorker),
        );
    }
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    let tier: Tier = tierFromHints({
      memoryGb: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
      saveData: nav.connection?.saveData,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    const root = document.documentElement;
    root.dataset.tier = tier;

    // Probe 90 frames once the page settles (load jank is not the phone's
    // speed); the median frame time ignores one-off long frames.
    const times: number[] = [];
    let last = 0;
    let raf = 0;
    const step = (t: number) => {
      if (last) times.push(t - last);
      last = t;
      if (times.length < 90) {
        raf = requestAnimationFrame(step);
        return;
      }
      times.sort((a, b) => a - b);
      tier = demote(tier, 1000 / times[times.length >> 1]);
      root.dataset.tier = tier;
    };
    const idle = setTimeout(() => (raf = requestAnimationFrame(step)), 2500);
    return () => {
      clearTimeout(idle);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
