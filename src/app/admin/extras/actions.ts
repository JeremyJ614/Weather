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

/** Sets one Extras item to on, off or hidden. */
export async function setExtrasItem(
  id: string,
  state: ItemState,
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin("extras");
  if (!EXTRAS_ITEMS.some((i) => i.id === id) || !ITEM_STATES.includes(state))
    return { error: "Unknown item." };
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "extras_items")
    .maybeSingle();
  const next: Record<string, ItemState> = { ...cleanItems(data?.value) };
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
  updateTag(SITE_DEFAULTS_TAG);
  revalidatePath("/extras");
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
