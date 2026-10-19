/**
 * Account preferences: the menus, theme, intro and saved places a member chose, kept on the
 * device and copied to their account (auth user metadata), so a new phone or browser picks
 * them up on sign-in. Every value is checked against what the app offers before it is kept.
 */
import { OFFERED } from "@/features/menus/catalog";
import { cleanQuick } from "@/lib/nav/quick";
import { parse as parsePlaces } from "@/features/location/store";
import { FONT_SETS, PALETTES } from "@/lib/theme/registry";
import type { IntroPref } from "@/features/intro/schedule";
import type { Prefs } from "./prefs-keys";

export { KEYS, type Prefs } from "./prefs-keys";

const INTROS = ["always", "daily", "first", "off"];

export function cleanPrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const out: Prefs = {};
  const m = r.menus as { main?: unknown; second?: unknown } | undefined;
  if (
    m &&
    typeof m.main === "string" &&
    typeof m.second === "string" &&
    OFFERED.main.includes(m.main) &&
    OFFERED.second.includes(m.second) &&
    m.main !== m.second
  )
    out.menus = { main: m.main, second: m.second };
  const t = r.theme as { palette?: unknown; font?: unknown } | undefined;
  if (
    t &&
    PALETTES.some((p) => p.id === t.palette) &&
    FONT_SETS.some((f) => f.id === t.font)
  )
    out.theme = { palette: String(t.palette), font: String(t.font) };
  if (typeof r.intro === "string" && INTROS.includes(r.intro))
    out.intro = r.intro as IntroPref;
  if (r.toured === true) out.toured = true;
  if (Array.isArray(r.quick)) out.quick = cleanQuick(r.quick);
  if (r.places && typeof r.places === "object") {
    const p = parsePlaces(JSON.stringify(r.places));
    if (p.list.length) out.places = p;
  }
  return out;
}
