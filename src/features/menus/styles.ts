import dynamic from "next/dynamic";
import { BOTTOM_BAR, type Placement } from "@/lib/nav/spots";
import type { MenuProps, MenuStyle } from "./types";

/* Each style's code loads only when someone has chosen it. */
const lazy = (load: () => Promise<(p: MenuProps) => React.ReactNode>) =>
  dynamic(load, { ssr: false });

const TOP: Placement[] = [
  { id: "top-right", zones: ["top-right"] },
  { id: "top-left", zones: ["top-left"] },
];
const TOP_LEFT_FIRST: Placement[] = [TOP[1], TOP[0]];
const BAR: Placement[] = [{ id: "bottom-bar", zones: BOTTOM_BAR }];
const FLOAT_CENTER: Placement[] = [
  { id: "bottom-center", zones: ["bottom-center"] },
  { id: "bottom-right", zones: ["bottom-right"] },
  { id: "bottom-left", zones: ["bottom-left"] },
];
const FLOAT_RIGHT: Placement[] = [
  FLOAT_CENTER[1],
  FLOAT_CENTER[2],
  FLOAT_CENTER[0],
];

const S = (
  id: string,
  name: string,
  placements: Placement[],
  Component: MenuStyle["Component"],
): MenuStyle => ({ id, name, placements, Component });

export const MENU_STYLES: Record<string, MenuStyle> = {
  sweep: S(
    "sweep",
    "Corner Sweep",
    TOP,
    lazy(() => import("./CornerSweep").then((m) => m.CornerSweep)),
  ),
  morph: S(
    "morph",
    "Morph FAB",
    FLOAT_RIGHT,
    lazy(() => import("./MorphFab").then((m) => m.MorphFab)),
  ),
  plates: S(
    "plates",
    "Radial Plates",
    FLOAT_CENTER,
    lazy(() => import("./RadialPlates").then((m) => m.RadialPlates)),
  ),
  ledger: S(
    "ledger",
    "Glass Ledger",
    FLOAT_CENTER,
    lazy(() => import("./GlassLedger").then((m) => m.GlassLedger)),
  ),
  split: S(
    "split",
    "Split Sidebar",
    TOP_LEFT_FIRST,
    lazy(() => import("./SplitSidebar").then((m) => m.SplitSidebar)),
  ),
  spotlight: S(
    "spotlight",
    "Mega Spotlight",
    TOP,
    lazy(() => import("./MegaSpotlight").then((m) => m.MegaSpotlight)),
  ),
  bentoboard: S(
    "bentoboard",
    "Bento Board",
    TOP,
    lazy(() => import("./BentoBoard").then((m) => m.BentoBoard)),
  ),
  bentolive: S(
    "bentolive",
    "Live Bento",
    TOP,
    lazy(() => import("./LiveBento").then((m) => m.LiveBento)),
  ),
  tabsheet: S(
    "tabsheet",
    "Tab Bar + Sheet",
    BAR,
    lazy(() => import("./TabSheet").then((m) => m.TabSheet)),
  ),
  scrolltabs: S(
    "scrolltabs",
    "Swipe Tabs",
    TOP,
    lazy(() => import("./SwipeTabs").then((m) => m.SwipeTabs)),
  ),
  railpop: S(
    "railpop",
    "Bottom Rail Pop",
    BAR,
    lazy(() => import("./RailPop").then((m) => m.RailPop)),
  ),
  vortex: S(
    "vortex",
    "StormSync Vortex",
    FLOAT_CENTER,
    lazy(() => import("./Vortex").then((m) => m.Vortex)),
  ),
  notch: S(
    "notch",
    "Notch Bar",
    BAR,
    lazy(() => import("./NotchBar").then((m) => m.NotchBar)),
  ),
};

/** The owner's offered lists (docs/04-DECISIONS.md), limited to styles already built. */
const OFFER_MAIN = [
  "sweep",
  "plates",
  "ledger",
  "split",
  "spotlight",
  "bentoboard",
  "bentolive",
  "tabsheet",
  "scrolltabs",
  "railpop",
  "vortex",
  "notch",
];
const OFFER_SECOND = [
  "morph",
  "plates",
  "depth",
  "split",
  "scrolltabs",
  "dial",
  "curtain",
  "vortex",
];
export const OFFERED = {
  main: OFFER_MAIN.filter((id) => MENU_STYLES[id]),
  second: OFFER_SECOND.filter((id) => MENU_STYLES[id]),
};

/** The owner's defaults (changeable from the admin panel in phase 07). */
export const DEFAULT_MENUS = { main: "sweep", second: "morph" };

/** Valid, offered, distinct choices; anything else falls back to a default. */
export function pickMenus(saved: { main?: string; second?: string }) {
  const main =
    saved.main && OFFERED.main.includes(saved.main)
      ? saved.main
      : DEFAULT_MENUS.main;
  let second =
    saved.second && OFFERED.second.includes(saved.second)
      ? saved.second
      : DEFAULT_MENUS.second;
  if (second === main)
    second =
      second === DEFAULT_MENUS.second
        ? (OFFERED.second.find((k) => k !== main) ?? DEFAULT_MENUS.second)
        : DEFAULT_MENUS.second;
  if (second === main) second = OFFERED.second.find((k) => k !== main)!;
  return { main, second };
}
