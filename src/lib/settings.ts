import { DEFAULT_MENUS, pickMenus } from "@/features/menus/catalog";
import { DEFAULT_THEME, FONT_SETS, PALETTES } from "@/lib/theme/registry";
import { ICON_NAMES } from "@/components/NavIcon";
import { cleanLayout, type MenuLayout } from "@/lib/nav/layout";
import { ALL_PAGES } from "@/lib/nav/registry";
import { cleanItems, type ExtrasStates } from "@/lib/extras/items";

export const SITE_DEFAULTS_TAG = "site-defaults";

export type Banner = { text: string; until: string | null };

export type SiteDefaults = {
  menus: { main: string; second: string };
  theme: { palette: string; font: string };
  /** Kill switches: modules showing a maintenance notice instead of their content. */
  disabled: string[];
  banner: Banner;
  /** The owner's menu arrangement, or null for the built-in menus. */
  layout: MenuLayout | null;
  /** Extras items switched off or hidden (admin → Extras); missing means on. */
  extras: ExtrasStates;
};

export const FALLBACK: SiteDefaults = {
  menus: DEFAULT_MENUS,
  theme: DEFAULT_THEME,
  disabled: [],
  banner: { text: "", until: null },
  layout: null,
  extras: {},
};

/** Keeps only valid, offered values; anything else falls back to the built-in default. */
export function cleanDefaults(
  raw: { key: string; value: unknown }[],
): SiteDefaults {
  const get = (k: string) =>
    (raw.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
  const m = get("menu_defaults");
  const t = get("theme_default");
  const menus = pickMenus(
    { main: String(m.main ?? ""), second: String(m.second ?? "") },
    DEFAULT_MENUS,
  );
  const palette = PALETTES.some((p) => p.id === t.palette)
    ? String(t.palette)
    : DEFAULT_THEME.palette;
  const font = FONT_SETS.some((f) => f.id === t.font)
    ? String(t.font)
    : DEFAULT_THEME.font;
  const off = raw.find((r) => r.key === "disabled_modules")?.value;
  const disabled = Array.isArray(off)
    ? off.filter((x): x is string => typeof x === "string").slice(0, 50)
    : [];
  const b = get("banner");
  const banner = {
    text: typeof b.text === "string" ? b.text.slice(0, 200) : "",
    until:
      typeof b.until === "string" && !Number.isNaN(Date.parse(b.until))
        ? b.until
        : null,
  };
  const layout = cleanLayout(
    raw.find((r) => r.key === "menu_layout")?.value,
    new Set(ALL_PAGES.map((p) => p.slug)),
    new Set(ICON_NAMES),
  );
  const extras = cleanItems(raw.find((r) => r.key === "extras_items")?.value);
  return { menus, theme: { palette, font }, disabled, banner, layout, extras };
}

/**
 * The owner's defaults for people who haven't chosen their own. Read with the public key
 * through the shared data cache, so pages stay static; saving in the admin panel refreshes it.
 */
export async function getSiteDefaults(): Promise<SiteDefaults> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return FALLBACK;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_config?select=key,value&key=in.(menu_defaults,theme_default,disabled_modules,banner,menu_layout,extras_items)`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: [SITE_DEFAULTS_TAG] },
      },
    );
    return res.ok ? cleanDefaults(await res.json()) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
