import "server-only";
import { cleanColors, type Colors } from "./registry";

export const COLORS_TAG = "color-overrides";

/** The admin's color overrides (cached; saving in the admin panel refreshes it). */
export async function getColors(): Promise<Colors> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const r = await fetch(
      `${url}/rest/v1/app_config?select=value&key=eq.color_overrides`,
      {
        headers: { apikey: key },
        next: { revalidate: 3600, tags: [COLORS_TAG] },
      },
    );
    if (!r.ok) return {};
    const rows = (await r.json()) as { value: unknown }[];
    return cleanColors(rows[0]?.value);
  } catch {
    return {};
  }
}
