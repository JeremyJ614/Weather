"use client";

import { useEffect } from "react";
import { demote, tierFromHints, type Tier } from "@/lib/device/tier";

/** Registers the service worker and sets data-tier on <html>. Renders nothing. */
export function DeviceSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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

    // Probe 60 frames after load; a slow phone gets demoted.
    let frames = 0;
    let start = 0;
    let raf = 0;
    const step = (t: number) => {
      if (!start) start = t;
      if (++frames < 60) {
        raf = requestAnimationFrame(step);
        return;
      }
      tier = demote(tier, (frames * 1000) / (t - start));
      root.dataset.tier = tier;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}
