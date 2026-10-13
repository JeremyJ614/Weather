"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributeFilter: ["data-tier"] });
  return () => mo.disconnect();
};

/** The measured device tier (`data-tier` on <html>); "high" until measured. */
export function useTier(): string {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.tier ?? "high",
    () => "high",
  );
}
