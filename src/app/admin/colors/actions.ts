"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { GROUPS, HEX, cleanColors } from "@/lib/colors/registry";
import { COLORS_TAG } from "@/lib/colors/server";

export type ColorState = { ok?: string; error?: string } | null;

/** Saves one group's colors; a color equal to its default is stored as no override. */
export async function saveGroup(
  _: ColorState,
  fd: FormData,
): Promise<ColorState> {
  const { supabase } = await requireAdmin("colors");
  const group = GROUPS.find((g) => g.id === fd.get("group"));
  if (!group) return { error: "Unknown color group." };
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "color_overrides")
    .maybeSingle();
  const next = cleanColors(data?.value);
  for (const e of group.entries) {
    const v = String(fd.get(e.key) ?? "").trim();
    if (!HEX.test(v))
      return { error: `${e.label}: use a hex code like #ff8800.` };
    if (v.toLowerCase() === e.def.toLowerCase()) delete next[e.key];
    else next[e.key] = v.toLowerCase();
  }
  const { error } = await supabase
    .from("app_config")
    .update({ value: next })
    .eq("key", "color_overrides");
  if (error) return { error: "The colors couldn't be saved." };
  await supabase.rpc("log_admin", {
    p_action: "save_colors",
    p_target: group.label,
  });
  updateTag(COLORS_TAG);
  revalidatePath("/", "layout");
  return { ok: "Saved. Maps pick it up on their next load." };
}
