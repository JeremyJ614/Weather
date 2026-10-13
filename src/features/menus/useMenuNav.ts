"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Open/close state that closes itself on navigation and on Escape. */
export function useMenuNav(role: "main" | "second") {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    // While one menu is open the other menu's controls step out of the way.
    const root = document.documentElement;
    root.dataset.menuOpen = role;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      if (root.dataset.menuOpen === role) delete root.dataset.menuOpen;
    };
  }, [open, role]);
  return { open, setOpen, path };
}
