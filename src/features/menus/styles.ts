import { BOTTOM_BAR } from "@/lib/nav/spots";
import { CornerSweep } from "./CornerSweep";
import { MorphFab } from "./MorphFab";
import type { MenuStyle } from "./types";

/** Menu styles available in the app. 06b and 06c add the rest of the offered styles. */
export const MENU_STYLES: Record<string, MenuStyle> = {
  sweep: {
    id: "sweep",
    name: "Corner Sweep",
    placements: [
      { id: "top-right", zones: ["top-right"] },
      { id: "top-left", zones: ["top-left"] },
    ],
    Component: CornerSweep,
  },
  morph: {
    id: "morph",
    name: "Morph FAB",
    placements: [
      { id: "bottom-right", zones: ["bottom-right"] },
      { id: "bottom-left", zones: ["bottom-left"] },
      { id: "bottom-center", zones: ["bottom-center"] },
    ],
    Component: MorphFab,
  },
};

/** The owner's defaults (changeable from the admin panel in phase 07). */
export const DEFAULT_MENUS = { main: "sweep", second: "morph" };

/** Valid, distinct choices: an unknown or duplicate pick falls back to a default. */
export function pickMenus(saved: { main?: string; second?: string }) {
  const main =
    saved.main && MENU_STYLES[saved.main] ? saved.main : DEFAULT_MENUS.main;
  let second =
    saved.second && MENU_STYLES[saved.second]
      ? saved.second
      : DEFAULT_MENUS.second;
  if (second === main)
    second =
      Object.keys(MENU_STYLES).find((k) => k !== main) ?? DEFAULT_MENUS.second;
  return { main, second };
}

export { BOTTOM_BAR };
