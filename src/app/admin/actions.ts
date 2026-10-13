"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SITE_DEFAULTS_TAG, cleanDefaults } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { sectionIds } from "@/lib/admin/sections";

const UUID = /^[0-9a-f-]{36}$/;

async function founder() {
  const ctx = await requireAdmin();
  if (!ctx.isFounder)
    throw new Error("Only the Founder can change admin access");
  return ctx;
}

export async function grantAdmin(fd: FormData) {
  const { supabase, viewer } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: id, role: "admin" });
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "grant_admin",
      p_target: name,
      p_detail: { by: viewer.name },
    });
  revalidatePath("/admin/admins");
}

export async function removeAdmin(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", id)
    .eq("role", "admin");
  if (!error)
    await supabase.rpc("log_admin", {
      p_action: "remove_admin",
      p_target: name,
    });
  revalidatePath("/admin/admins");
}

export async function setSections(fd: FormData) {
  const { supabase } = await founder();
  const id = String(fd.get("userId") ?? "");
  const name = String(fd.get("name") ?? "");
  if (!UUID.test(id)) return;
  const want = fd
    .getAll("section")
    .map(String)
    .filter((s) => sectionIds.has(s) && s !== "admins");
  await supabase.from("admin_permissions").delete().eq("user_id", id);
  if (want.length) {
    await supabase
      .from("admin_permissions")
      .insert(want.map((section) => ({ user_id: id, section })));
  }
  await supabase.rpc("log_admin", {
    p_action: "set_sections",
    p_target: name,
    p_detail: { sections: want },
  });
  revalidatePath("/admin/admins");
}

export type SaveState = { error?: string; saved?: boolean } | null;

/** Menu & theme defaults for everyone who hasn't picked their own. */
export async function saveDefaults(
  _: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const { supabase } = await requireAdmin("menus");
  const want = cleanDefaults([
    {
      key: "menu_defaults",
      value: { main: fd.get("main"), second: fd.get("second") },
    },
    {
      key: "theme_default",
      value: { palette: fd.get("palette"), font: fd.get("font") },
    },
  ]);
  const results = await Promise.all([
    supabase
      .from("app_config")
      .update({ value: want.menus, updated_at: new Date().toISOString() })
      .eq("key", "menu_defaults"),
    supabase
      .from("app_config")
      .update({ value: want.theme, updated_at: new Date().toISOString() })
      .eq("key", "theme_default"),
  ]);
  if (results.some((r) => r.error))
    return { error: "The defaults couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: "set_defaults",
    p_target: "menus & theme",
    p_detail: want,
  });
  updateTag(SITE_DEFAULTS_TAG);
  return { saved: true };
}
