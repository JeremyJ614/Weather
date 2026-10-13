import type { NavGroup, NavPage } from "./registry";

/**
 * The owner's menu arrangement (admin → Menu editor), saved as app_config `menu_layout`.
 * Sections list page slugs in order; `pages` renames, re-icons or hides single pages.
 * Pages the layout doesn't mention (built after it was saved) still appear, in their
 * built-in section, so a new page is never lost from the menus.
 */
export type LayoutGroup = {
  id: string;
  label: string;
  icon: string;
  pages: string[];
};
export type PageEdit = { label?: string; icon?: string; hidden?: boolean };
export type MenuLayout = {
  main: LayoutGroup[];
  second: LayoutGroup[];
  pages: Record<string, PageEdit>;
};

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Keeps only valid sections and known pages, each page once. */
export function cleanLayout(
  raw: unknown,
  known: Set<string>,
  icons: Set<string>,
): MenuLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const ids = new Set<string>();
  const groups = (list: unknown): LayoutGroup[] =>
    (Array.isArray(list) ? list : []).slice(0, 30).flatMap((g) => {
      if (!g || typeof g !== "object") return [];
      const r = g as Record<string, unknown>;
      let id = text(r.id, 40).replace(/[^\w-]/g, "") || "section";
      while (ids.has(id)) id += "-2";
      ids.add(id);
      const label = text(r.label, 40);
      if (!label) return [];
      const pages = (Array.isArray(r.pages) ? r.pages : []).filter(
        (s): s is string =>
          typeof s === "string" &&
          known.has(s) &&
          !seen.has(s) &&
          !!seen.add(s),
      );
      return [
        {
          id,
          label,
          icon: icons.has(String(r.icon)) ? String(r.icon) : "Folder",
          pages,
        },
      ];
    });
  const main = groups(o.main);
  const second = groups(o.second);
  const pages: Record<string, PageEdit> = {};
  const pe = o.pages && typeof o.pages === "object" ? o.pages : {};
  for (const [slug, v] of Object.entries(pe as Record<string, unknown>)) {
    if (!known.has(slug) || !v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const edit: PageEdit = {};
    const label = text(e.label, 40);
    if (label) edit.label = label;
    if (icons.has(String(e.icon))) edit.icon = String(e.icon);
    if (e.hidden === true) edit.hidden = true;
    if (Object.keys(edit).length) pages[slug] = edit;
  }
  if (!main.length && !second.length) return null;
  return { main, second, pages };
}

/** The layout as a starting point for the editor: the built-in menus, unchanged. */
export function layoutFrom(main: NavGroup[], second: NavGroup[]): MenuLayout {
  const g = (list: NavGroup[]) =>
    list.map((x) => ({
      id: x.id,
      label: x.label,
      icon: x.icon,
      pages: x.pages.map((p) => p.slug),
    }));
  return { main: g(main), second: g(second), pages: {} };
}

/**
 * One menu's groups after the owner's layout: sections in the saved order, each
 * page with its edits; hidden pages and empty sections are left out.
 */
export function applyLayout(
  builtIn: NavGroup[],
  others: NavGroup[],
  layout: MenuLayout | null,
  menu: "main" | "second",
): NavGroup[] {
  if (!layout) return builtIn;
  const all = new Map<string, NavPage>();
  const home = new Map<string, string>();
  for (const g of [...builtIn, ...others])
    for (const p of g.pages) {
      all.set(p.slug, p);
      home.set(p.slug, g.id);
    }
  const placed = new Set(
    [...layout.main, ...layout.second].flatMap((g) => g.pages),
  );
  const edit = (p: NavPage): NavPage | null => {
    const e = layout.pages[p.slug];
    if (e?.hidden) return null;
    return {
      ...p,
      ...(e?.label && { label: e.label }),
      ...(e?.icon && { icon: e.icon }),
    };
  };
  const groups: NavGroup[] = layout[menu].map((g) => ({
    id: g.id,
    label: g.label,
    icon: g.icon,
    pages: g.pages.flatMap((s) => {
      const p = all.get(s);
      const e = p && edit(p);
      return e ? [e] : [];
    }),
  }));
  // Pages built after the layout was saved join their built-in section in this menu.
  for (const g of builtIn) {
    const fresh = g.pages.filter((p) => !placed.has(p.slug));
    if (!fresh.length) continue;
    let target = groups.find((x) => x.id === g.id);
    if (!target) {
      target = { id: g.id, label: g.label, icon: g.icon, pages: [] };
      groups.push(target);
    }
    for (const p of fresh) {
      const e = edit(p);
      if (e && home.get(p.slug) === g.id) target.pages.push(e);
    }
  }
  return groups.filter((g) => g.pages.length);
}
