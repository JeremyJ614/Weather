"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  cleanItems,
  EXTRAS_ITEMS,
  ITEM_STATES,
  type ItemState,
} from "@/lib/extras/items";
import { SITE_DEFAULTS_TAG } from "@/lib/settings";
import { cleanBilling } from "@/lib/billing/plans";
import { BILLING_TAG, SELLABLE_SLUGS } from "@/lib/billing/server";

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/**
 * A page that leaves Extras starts on the same plans as the Extras page, so nobody who could
 * open it yesterday is locked out today; the owner changes that in Pricing.
 */
async function inheritPlans(supabase: Db, slug: string) {
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "billing")
    .maybeSingle();
  if (!data) return;
  const b = cleanBilling(data.value, new Set(SELLABLE_SLUGS));
  let changed = false;
  for (const t of b.tiers)
    if (t.pages.includes("extras") && !t.pages.includes(slug)) {
      t.pages.push(slug);
      changed = true;
    }
  if (!changed) return;
  const { error } = await supabase
    .from("app_config")
    .update({ value: b, updated_at: new Date().toISOString() })
    .eq("key", "billing");
  if (!error) updateTag(BILLING_TAG);
}

/** Sets one Extras item to on, off, hidden or its own page. */
export async function setExtrasItem(
  id: string,
  state: ItemState,
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin("extras");
  const item = EXTRAS_ITEMS.find((i) => i.id === id);
  if (!item || !ITEM_STATES.includes(state)) return { error: "Unknown item." };
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "extras_items")
    .maybeSingle();
  const next: Record<string, ItemState> = { ...cleanItems(data?.value) };
  const was = next[id] ?? "on";
  if (state === "on") delete next[id];
  else next[id] = state;
  const { error } = await supabase
    .from("app_config")
    .update({ value: next, updated_at: new Date().toISOString() })
    .eq("key", "extras_items");
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "extras_item",
    p_target: id,
    p_detail: { state },
  });
  if (state === "page" && was !== "page")
    await inheritPlans(supabase, item.slug);
  updateTag(SITE_DEFAULTS_TAG);
  revalidatePath("/extras");
  revalidatePath(`/${item.slug}`);
  // The menus live in the root layout.
  if ((state === "page") !== (was === "page")) revalidatePath("/", "layout");
  return {};
}

export type DeerSeasons = {
  state: string;
  seasons: { name: string; start: string; end: string }[];
  rut: { pre: string; peak: string; post: string; end: string };
};
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MD = /^\d{2}-\d{2}$/;

/** Deer Activity's hunting seasons and rut dates (admin → Extras). */
export async function saveDeerSeasons(
  v: DeerSeasons,
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin("extras");
  const state = String(v.state ?? "")
    .trim()
    .slice(0, 30);
  const seasons = (Array.isArray(v.seasons) ? v.seasons : [])
    .slice(0, 12)
    .map((s) => ({
      name: String(s.name ?? "")
        .trim()
        .slice(0, 30),
      start: String(s.start ?? ""),
      end: String(s.end ?? ""),
    }));
  if (!state) return { error: "Name the state." };
  if (
    seasons.some(
      (s) =>
        !s.name || !YMD.test(s.start) || !YMD.test(s.end) || s.end < s.start,
    )
  )
    return { error: "Each season needs a name, a start and an end after it." };
  const rut = {
    pre: String(v.rut?.pre ?? ""),
    peak: String(v.rut?.peak ?? ""),
    post: String(v.rut?.post ?? ""),
    end: String(v.rut?.end ?? ""),
  };
  if (!Object.values(rut).every((d) => MD.test(d)))
    return { error: "Rut dates are month-day, like 11-05." };
  const { error } = await supabase
    .from("app_config")
    .update({
      value: { state, seasons, rut },
      updated_at: new Date().toISOString(),
    })
    .eq("key", "deer_seasons");
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "deer_seasons",
    p_target: state,
    p_detail: { seasons: seasons.length },
  });
  return {};
}
