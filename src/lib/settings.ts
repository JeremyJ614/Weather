import { DEFAULT_MENUS, pickMenus } from "@/features/menus/catalog";
import { DEFAULT_THEME, FONT_SETS, PALETTES } from "@/lib/theme/registry";

export const SITE_DEFAULTS_TAG = "site-defaults";

export type Banner = { text: string; until: string | null };

export type SiteDefaults = {
  menus: { main: string; second: string };
  theme: { palette: string; font: string };
  /** Kill switches: modules showing a maintenance notice instead of their content. */
  disabled: string[];
  banner: Banner;
};

export const FALLBACK: SiteDefaults = {
  menus: DEFAULT_MENUS,
  theme: DEFAULT_THEME,
  disabled: [],
  banner: { text: "", until: null },
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
  return { menus, theme: { palette, font }, disabled, banner };
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
      `${url}/rest/v1/app_config?select=key,value&key=in.(menu_defaults,theme_default,disabled_modules,banner)`,
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
