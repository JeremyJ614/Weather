"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";

export type ReleaseState = { error?: string; saved?: boolean } | null;

export async function addRelease(
  _: ReleaseState,
  fd: FormData,
): Promise<ReleaseState> {
  const { supabase } = await requireAdmin("news");
  const version = String(fd.get("version") ?? "").trim();
  const title = String(fd.get("title") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  if (!/^[0-9A-Za-z.\-]{1,20}$/.test(version))
    return {
      error: "Version: up to 20 letters, numbers, dots or dashes (e.g. 1.4.0).",
    };
  if (!title || title.length > 120)
    return { error: "Add a title (up to 120 characters)." };
  if (notes.length > 4000)
    return { error: "Notes can be up to 4,000 characters." };
  const { error } = await supabase
    .from("app_releases")
    .insert({ version, title, notes });
  if (error) return { error: "Couldn't save. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "add_release",
    p_target: `v${version} ${title}`,
  });
  updateTag("app-updates");
  revalidatePath("/admin/releases");
  return { saved: true };
}

export async function removeRelease(fd: FormData) {
  const { supabase } = await requireAdmin("news");
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  const { data } = await supabase
    .from("app_releases")
    .select("version")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("app_releases").delete().eq("id", id);
  if (data)
    await supabase.rpc("log_admin", {
      p_action: "remove_release",
      p_target: `v${data.version}`,
    });
  updateTag("app-updates");
  revalidatePath("/admin/releases");
}
