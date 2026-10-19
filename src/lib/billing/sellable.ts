import { ALL_PAGES } from "@/lib/nav/registry";
import { ALWAYS } from "./plans";

/** Every page that can be sold (on a tier, in a custom plan or as an add-on). */
export const SELLABLE = ALL_PAGES.filter(
  (p) => !ALWAYS.has(p.slug) && !p.adminOnly,
);
export const SELLABLE_SLUGS = SELLABLE.map((p) => p.slug);
