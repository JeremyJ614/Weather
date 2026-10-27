import { EXTRAS_ITEMS, onPages, type ExtrasStates } from "@/lib/extras/items";
import { ALL_PAGES, type NavGroup, type NavPage } from "./registry";

/**
 * Every Extras item's own page (admin → Extras → Own page). Kept out of the registry so the
 * menus' client code doesn't carry the Extras list; only items the owner moved out of Extras
 * are served, shown in the menus or offered on the plans, the rest answer 404.
 */
export const EXTRAS_GROUP: NavGroup = {
  id: "extras-pages",
  label: "Extras",
  icon: "FlaskConical",
  pages: EXTRAS_ITEMS.map((i) => ({
    slug: i.slug,
    label: i.name,
    icon: i.icon,
    phase: "Extras",
  })),
};
const SLUGS = new Set(EXTRAS_GROUP.pages.map((x) => x.slug));
export const isExtrasPage = (slug: string) => SLUGS.has(slug);

/** The Extras section as the menus show it: just the items that have pages now. */
export const extrasGroup = (s: ExtrasStates): NavGroup => {
  const on = new Set(onPages(s).map((i) => i.slug));
  return {
    ...EXTRAS_GROUP,
    pages: EXTRAS_GROUP.pages.filter((x) => on.has(x.slug)),
  };
};

/** Every page there can be, Extras items' own pages included (for locks and the editors). */
export const EVERY_PAGE: NavPage[] = [...ALL_PAGES, ...EXTRAS_GROUP.pages];
