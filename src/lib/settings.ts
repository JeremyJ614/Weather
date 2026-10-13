import { DEFAULT_MENUS, pickMenus } from "@/features/menus/catalog";
import { DEFAULT_THEME, FONT_SETS, PALETTES } from "@/lib/theme/registry";

export const SITE_DEFAULTS_TAG = "site-defaults";

export type SiteDefaults = {
  menus: { main: string; second: string };
  theme: { palette: string; font: string };
};

export const FALLBACK: SiteDefaults = {
  menus: DEFAULT_MENUS,
  theme: DEFAULT_THEME,
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
  return { menus, theme: { palette, font } };
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
      `${url}/rest/v1/app_config?select=key,value&key=in.(menu_defaults,theme_default)`,
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
