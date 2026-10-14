"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { RARITIES } from "@/lib/badges";
import { BADGE_ICON_NAMES } from "@/lib/badge-icons";

export type BadgeState = { error?: string; ok?: string } | null;

/** Creates a badge, or updates one when `id` is set. */
export async function saveBadge(
  _: BadgeState,
  fd: FormData,
): Promise<BadgeState> {
  const { supabase } = await requireAdmin("badges");
  const s = (k: string, n: number) =>
    String(fd.get(k) ?? "")
      .trim()
      .slice(0, n);
  const id = s("id", 36);
  const row = {
    name: s("name", 40),
    description: s("description", 160),
    icon: s("icon", 32),
    rarity: s("rarity", 12),
    grp: s("grp", 30) || "General",
  };
  if (!row.name) return { error: "Give the badge a name." };
  if (!BADGE_ICON_NAMES.includes(row.icon)) return { error: "Pick an icon." };
  if (!RARITIES.includes(row.rarity)) return { error: "Pick a rarity." };
  if (id && !/^[0-9a-f-]{36}$/.test(id))
    return { error: "That badge couldn't be found." };
  const { error } = id
    ? await supabase.from("badges").update(row).eq("id", id)
    : await supabase.from("badges").insert(row);
  if (error) return { error: "The badge couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: id ? "edit_badge" : "add_badge",
    p_target: row.name,
    p_detail: { rarity: row.rarity },
  });
  revalidatePath("/admin/badges");
  return { ok: id ? "Saved." : `${row.name} added.` };
}

export async function deleteBadge(id: string, name: string) {
  const { supabase } = await requireAdmin("badges");
  if (!/^[0-9a-f-]{36}$/.test(id))
    return { error: "That badge couldn't be found." };
  const { error } = await supabase.from("badges").delete().eq("id", id);
  if (error) return { error: "It couldn't be deleted. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "delete_badge",
    p_target: name,
    p_detail: {},
  });
  revalidatePath("/admin/badges");
  return {};
}
