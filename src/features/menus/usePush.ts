"use client";

import { useEffect } from "react";

/** Tilts the page content (#app-content) for drawer-style menus while open. */
export function usePush(kind: string, open: boolean, side: "left" | "right") {
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.dataset.push = kind;
      root.dataset.pushSide = side;
    }
    return () => {
      if (root.dataset.push === kind) {
        delete root.dataset.push;
        delete root.dataset.pushSide;
      }
    };
  }, [kind, open, side]);
}
