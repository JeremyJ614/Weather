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

const FLOAT_LEFT: Placement[] = [
  FLOAT_CENTER[2],
  FLOAT_CENTER[1],
  FLOAT_CENTER[0],
];
const SEARCH: Placement[] = [TOP[1], TOP[0], FLOAT_LEFT[0], FLOAT_RIGHT[0]];
// The dock is a short centered bar; beside another bottom menu it rides above it.
const DOCK: Placement[] = [{ id: "bottom-bar", zones: ["bottom-center"] }];

const EDGE: Placement[] = [
  { id: "right-edge", zones: ["right"] },
  { id: "left-edge", zones: ["left"] },
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
  dial: S(
    "dial",
    "Speed Dial",
    FLOAT_RIGHT,
    lazy(() => import("./SpeedDial").then((m) => m.SpeedDial)),
  ),
  capsule: S(
    "capsule",
    "Quick Capsule",
    FLOAT_RIGHT,
    lazy(() => import("./QuickCapsule").then((m) => m.QuickCapsule)),
  ),
  peek: S(
    "peek",
    "Edge Peek",
    EDGE,
    lazy(() => import("./EdgePeek").then((m) => m.EdgePeek)),
  ),
  wallet: S(
    "wallet",
    "Wallet Stack",
    TOP,
    lazy(() => import("./WalletStack").then((m) => m.WalletStack)),
  ),
  iris: S(
    "iris",
    "Iris",
    TOP,
    lazy(() => import("./Iris").then((m) => m.Iris)),
  ),
  radar: S(
    "radar",
    "Radar Scope",
    FLOAT_RIGHT,
    lazy(() => import("./RadarScope").then((m) => m.RadarScope)),
  ),
  palette: S(
    "palette",
    "Command Palette",
    SEARCH,
    lazy(() => import("./CommandPalette").then((m) => m.CommandPalette)),
  ),
  dock: S(
    "dock",
    "Magnify Dock",
    DOCK,
    lazy(() => import("./MagnifyDock").then((m) => m.MagnifyDock)),
  ),
  deck: S(
    "deck",
    "Flip Deck",
    FLOAT_LEFT,
    lazy(() => import("./FlipDeck").then((m) => m.FlipDeck)),
  ),
  ripple: S(
    "ripple",
    "Ripple Grid",
    FLOAT_RIGHT,
    lazy(() => import("./RippleGrid").then((m) => m.RippleGrid)),
  ),
};

/** The owner's offered lists (docs/04-DECISIONS.md), limited to styles already built. */

export { DEFAULT_MENUS, OFFERED, pickMenus } from "./catalog";
