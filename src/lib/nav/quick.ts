import { ALL_PAGES, SECOND_NAV, type NavGroup, type NavPage } from "./registry";

/**
 * The Quick Menu (the second menu): the storm chasing pages first, always, then the pages
 * a member pinned in Account Settings, each as its own shortcut.
 */
export const QUICK_MAX = 8;
/** Always in the Quick Menu, for anyone whose plan opens them. */
export const QUICK_FIXED = [
  "storm-chasing-outlook",
  ...SECOND_NAV.flatMap((g) => g.pages.map((p) => p.slug)),
];
/** Pages that can't be pinned: the fixed ones and sign-in. */
const NOT_PINNABLE = new Set([...QUICK_FIXED, "login"]);
export const PINNABLE: NavPage[] = ALL_PAGES.filter(
  (p) => !NOT_PINNABLE.has(p.slug),
);

export function cleanQuick(raw: unknown[]): string[] {
  const ok = new Set(PINNABLE.map((p) => p.slug));
  return [
    ...new Set(
      raw.filter((x): x is string => typeof x === "string" && ok.has(x)),
    ),
  ].slice(0, QUICK_MAX);
}

const one = (p: NavPage): NavGroup => ({
  id: `quick-${p.slug || "home"}`,
  label: p.label,
  icon: p.icon,
  pages: [p],
});

/**
 * The second menu's groups: the owner's arrangement of the chasing pages, Storm Chasing
 * Outlook if it isn't there yet, then the member's pins. Pages the viewer may not see or
 * whose plan doesn't open them are left out.
 */
export function quickGroups(
  owner: NavGroup[],
  picks: string[],
  opts: { isAdmin: boolean; locked: string[] },
): NavGroup[] {
  const seen = new Set(owner.flatMap((g) => g.pages.map((p) => p.slug)));
  const page = (slug: string) => ALL_PAGES.find((p) => p.slug === slug);
  const allowed = (p: NavPage) =>
    (opts.isAdmin || !p.adminOnly) && !opts.locked.includes(p.slug);
  const pages = (slugs: string[]) =>
    slugs
      .filter((x) => !seen.has(x))
      .map(page)
      .filter((p): p is NavPage => !!p && allowed(p))
      .map(one);
  const chase = owner
    .map((g) => ({ ...g, pages: g.pages.filter(allowed) }))
    .filter((g) => g.pages.length);
  return [...pages(QUICK_FIXED), ...chase, ...pages(cleanQuick(picks))];
}
