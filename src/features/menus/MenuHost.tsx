"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MAIN_NAV, SECOND_NAV, visibleNav } from "@/lib/nav/registry";
import { resolvePlacements } from "@/lib/nav/spots";
import { useViewer } from "@/features/account/useViewer";
import { MENU_STYLES, pickMenus } from "./styles";

const KEY = "sswx-menus";
const subscribe = (cb: () => void) => {
  addEventListener("storage", cb);
  return () => removeEventListener("storage", cb);
};
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

/** Renders the user's main and second menus with non-overlapping placements. */
export function MenuHost({
  defaults,
}: {
  defaults: { main: string; second: string };
}) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  let saved: { main?: string; second?: string } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {}
  const { main, second } = pickMenus(saved, defaults);
  const M = MENU_STYLES[main];
  const S = MENU_STYLES[second];
  const { main: mp, second: sp } = resolvePlacements(
    M.placements,
    S.placements,
  );
  const bar = [mp, sp].some((p) => p.id === "bottom-bar");
  const topLeft = [mp, sp].some((p) => p.id.startsWith("top-left"));
  useEffect(() => {
    // Pages keep their last lines clear of a full-width bottom bar.
    const root = document.documentElement;
    if (bar) root.dataset.bottomBar = "";
    else delete root.dataset.bottomBar;
    // The header's logo takes whichever top corner no menu uses.
    if (topLeft) root.dataset.logoSide = "right";
    else delete root.dataset.logoSide;
  }, [bar, topLeft]);
  // Admin-only pages are listed only for admins; the pages themselves check on the server.
  const { isAdmin, signedIn } = useViewer();
  return (
    <>
      <M.Component
        groups={visibleNav(MAIN_NAV, isAdmin, signedIn)}
        placement={mp}
        role="main"
      />
      <S.Component
        groups={visibleNav(SECOND_NAV, isAdmin, signedIn)}
        placement={sp}
        role="second"
      />
    </>
  );
}
