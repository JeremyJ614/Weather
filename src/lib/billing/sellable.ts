import { EVERY_PAGE, isExtrasPage } from "@/lib/nav/extras";
import { onPages, type ExtrasStates } from "@/lib/extras/items";
import { ALWAYS } from "./plans";

/** Every page that can be sold (on a tier, in a custom plan or as an add-on). */
export const SELLABLE = EVERY_PAGE.filter(
  (p) => !ALWAYS.has(p.slug) && !p.adminOnly,
);
export const SELLABLE_SLUGS = SELLABLE.map((p) => p.slug);

/**
 * The pages to offer right now: Extras items count only while they have pages of their own
 * (admin → Extras → Own page). Locks still know every slug, so a plan keeps a page that
 * moves back into Extras and gets it again if it comes out.
 */
export const sellableNow = (extras: ExtrasStates) => {
  const on = new Set(onPages(extras).map((i) => i.slug));
  return SELLABLE.filter((p) => !isExtrasPage(p.slug) || on.has(p.slug));
};
