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
