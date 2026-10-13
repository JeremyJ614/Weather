"use client";

import { useSyncExternalStore } from "react";
import { MAIN_NAV, SECOND_NAV, visibleNav } from "@/lib/nav/registry";
import { resolvePlacements } from "@/lib/nav/spots";
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
export function MenuHost() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  let saved: { main?: string; second?: string } = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {}
  const { main, second } = pickMenus(saved);
  const M = MENU_STYLES[main];
  const S = MENU_STYLES[second];
  const { main: mp, second: sp } = resolvePlacements(
    M.placements,
    S.placements,
  );
  // Admin-only pages appear once accounts exist (phase 08/09).
  const isAdmin = false;
  return (
    <>
      <M.Component
        groups={visibleNav(MAIN_NAV, isAdmin)}
        placement={mp}
        role="main"
      />
      <S.Component
        groups={visibleNav(SECOND_NAV, isAdmin)}
        placement={sp}
        role="second"
      />
    </>
  );
}
