"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useIsImmersive } from "@/lib/immersive";
import { visibleNav, type NavGroup } from "@/lib/nav/registry";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { resolvePlacements } from "@/lib/nav/spots";
import { quickGroups } from "@/lib/nav/quick";
import { KEYS } from "@/lib/prefs-keys";
import { useViewer } from "@/features/account/useViewer";
import { MENU_STYLES, pickMenus } from "./styles";

const KEY = "sswx-menus";
const ADMIN_GROUP: NavGroup = {
  id: "admin-shortcuts",
  label: "Admin",
  icon: "ShieldCheck",
  pages: [
    {
      slug: "admin",
      label: "Admin overview",
      icon: "ShieldCheck",
      phase: "11",
    },
    ...ADMIN_SECTIONS.filter((s) => s.href).map((s) => ({
      slug: s.href!.slice(1),
      label: s.label,
      icon: s.icon,
      phase: s.phase,
    })),
  ],
};
const SHOWCASE_GROUP: NavGroup = {
  id: "showcase",
  label: "Showcase",
  icon: "Sparkles",
  pages: [
    {
      slug: "?showcase",
      label: "Replay the showcase",
      icon: "Sparkles",
      phase: "62c",
    },
  ],
};
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
const readQuick = () => {
  try {
    return localStorage.getItem(KEYS.quick) ?? "";
  } catch {
    return "";
  }
};

/** Renders the user's main and second menus with non-overlapping placements. */
export function MenuHost({
  defaults,
  main: mainGroups,
  second: secondGroups,
}: {
  defaults: { main: string; second: string };
  /** The menus after the owner's arrangement (admin → Menu editor). */
  main: NavGroup[];
  second: NavGroup[];
}) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const quickRaw = useSyncExternalStore(subscribe, readQuick, () => "");
  const immersive = useIsImmersive();
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
  const { isAdmin, signedIn, adminShortcuts, pending, locked } = useViewer();
  const guest = !signedIn && !pending;
  let picks: string[] = [];
  try {
    picks = quickRaw ? JSON.parse(quickRaw) : [];
  } catch {}
  // The Quick Menu: chasing pages always, then the member's pins (Account Settings).
  const seconds = guest
    ? visibleNav(secondGroups, isAdmin, signedIn, guest)
    : quickGroups(
        visibleNav(secondGroups, isAdmin, signedIn, guest),
        Array.isArray(picks) ? picks : [],
        { isAdmin, locked: locked ?? [] },
      );
  // Guests can replay the showcase from the second menu.
  if (guest) seconds.push(SHOWCASE_GROUP);
  // The owner's switchable Admin shortcuts group (admin → Overview).
  if (adminShortcuts) seconds.push(ADMIN_GROUP);
  if (immersive) return null;
  return (
    <>
      <M.Component
        groups={visibleNav(mainGroups, isAdmin, signedIn, guest)}
        placement={mp}
        role="main"
      />
      <S.Component groups={seconds} placement={sp} role="second" />
    </>
  );
}
