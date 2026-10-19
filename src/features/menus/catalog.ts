/**
 * Menu catalog without components, safe to import from server code: names, the owner's offered
 * lists and the defaults. `styles.ts` adds the lazy-loaded components.
 */
export const MENU_NAMES: Record<string, string> = {
  sweep: "Corner Sweep",
  morph: "Morph FAB",
  plates: "Radial Plates",
  ledger: "Glass Ledger",
  split: "Split Sidebar",
  spotlight: "Mega Spotlight",
  bentoboard: "Bento Board",
  bentolive: "Live Bento",
  tabsheet: "Tab Bar + Sheet",
  scrolltabs: "Swipe Tabs",
  railpop: "Bottom Rail Pop",
  vortex: "StormSync Vortex",
  notch: "Notch Bar",
  depth: "Depth Drawer",
  dial: "Speed Dial",
  curtain: "Curtain Reveal",
  capsule: "Quick Capsule",
  peek: "Edge Peek",
};

export const OFFERED = {
  main: [
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
  ].filter((id) => MENU_NAMES[id]),
  second: [
    "capsule",
    "peek",
    "morph",
    "plates",
    "depth",
    "split",
    "scrolltabs",
    "dial",
    "curtain",
    "vortex",
  ].filter((id) => MENU_NAMES[id]),
};

/** Built-in defaults; the admin panel's choices (app_config) override them. */
export const DEFAULT_MENUS = { main: "sweep", second: "morph" };

/** Valid, offered, distinct choices; anything else falls back to the defaults. */
export function pickMenus(
  saved: { main?: string; second?: string },
  defaults: { main: string; second: string } = DEFAULT_MENUS,
) {
  const d = {
    main: OFFERED.main.includes(defaults.main)
      ? defaults.main
      : DEFAULT_MENUS.main,
    second: OFFERED.second.includes(defaults.second)
      ? defaults.second
      : DEFAULT_MENUS.second,
  };
  const main =
    saved.main && OFFERED.main.includes(saved.main) ? saved.main : d.main;
  let second =
    saved.second && OFFERED.second.includes(saved.second)
      ? saved.second
      : d.second;
  if (second === main)
    second =
      OFFERED.second.find((k) => k !== main && k === d.second) ??
      OFFERED.second.find((k) => k !== main)!;
  return { main, second };
}
