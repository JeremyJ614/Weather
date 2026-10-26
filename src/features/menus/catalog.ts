/**
 * Menu catalog without components, safe to import from server code: names, the owner's offered
 * lists and the defaults. `styles.ts` adds the lazy-loaded components.
 */
export const MENU_NAMES: Record<string, string> = {
  sweep: "Corner Sweep",
  plates: "Radial Plates",
  ledger: "Glass Ledger",
  spotlight: "Mega Spotlight",
  bentoboard: "Bento Board",
  tabsheet: "Tab Bar + Sheet",
  scrolltabs: "Swipe Tabs",
  vortex: "StormSync Vortex",
  dial: "Speed Dial",
  capsule: "Quick Capsule",
  peek: "Edge Peek",
  wallet: "Wallet Stack",
  iris: "Iris",
  palette: "Command Palette",
  dock: "Magnify Dock",
  deck: "Flip Deck",
  ripple: "Ripple Grid",
  hive: "Hive",
  orbit: "Orbit",
  shutter: "Shutter",
  ribbon: "Ribbon Fold",
  island: "Island",
  rotary: "Rotary",
  liquid: "Liquid Metal",
  kinetic: "Kinetic Type",
  jelly: "Jelly Drawer",
  switcher: "Switcher",
  keycaps: "Keycaps",
};

export const OFFERED = {
  main: [
    "sweep",
    "plates",
    "ledger",
    "spotlight",
    "bentoboard",
    "wallet",
    "iris",
    "tabsheet",
    "scrolltabs",
    "vortex",
    "hive",
    "orbit",
    "shutter",
    "ribbon",
    "liquid",
    "kinetic",
    "jelly",
  ].filter((id) => MENU_NAMES[id]),
  second: [
    "island",
    "rotary",
    "ribbon",
    "capsule",
    "peek",
    "plates",
    "palette",
    "dock",
    "deck",
    "ripple",
    "dial",
    "vortex",
    "switcher",
    "keycaps",
  ].filter((id) => MENU_NAMES[id]),
};

/** Built-in defaults; the admin panel's choices (app_config) override them. */
export const DEFAULT_MENUS = { main: "sweep", second: "peek" };

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
