"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Open/close state that closes itself on a link tap, on navigation and on Escape. */
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
    // Close the moment a link is tapped: a data-heavy page can take a few seconds to
    // arrive, and the open menu would otherwise sit over it as if nothing happened.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a && !(e.metaKey || e.ctrlKey || e.shiftKey)) setOpen(false);
    };
    addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    return () => {
      removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
      if (root.dataset.menuOpen === role) delete root.dataset.menuOpen;
    };
  }, [open, role]);
  return { open, setOpen, path };
}
