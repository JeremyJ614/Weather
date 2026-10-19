"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Immersive screens (the Tornado Archive and Chase Log replays) take the whole viewport: the
 * header and menus step aside while one is open, so the screen draws and listens to nothing
 * but the replay.
 */
const EVT = "sswx-immersive";
const subscribe = (cb: () => void) => {
  addEventListener(EVT, cb);
  return () => removeEventListener(EVT, cb);
};
const read = () => document.documentElement.dataset.immersive !== undefined;

export function useImmersive(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.dataset.immersive = "";
    dispatchEvent(new Event(EVT));
    return () => {
      delete root.dataset.immersive;
      dispatchEvent(new Event(EVT));
    };
  }, [on]);
}

export const useIsImmersive = () =>
  useSyncExternalStore(subscribe, read, () => false);
